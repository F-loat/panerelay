import { spawn } from 'node:child_process';
import type {
  FirefoxAutomationReadinessReason,
  WebDriverReadinessMessage,
} from '@panerelay/protocol';
import { PANERELAY_PROTOCOL_VERSION } from '@panerelay/protocol';
import {
  isManagedFirefoxEnvironment,
  type FirefoxAutomationRuntimeConfig,
} from './firefox-automation.js';

const DRIVER_START_TIMEOUT_MS = 10_000;
const DRIVER_REQUEST_TIMEOUT_MS = 10_000;
const MAX_DRIVER_RESPONSE_BYTES = 16 * 1024 * 1024;

interface DriverProcess {
  kill(signal?: NodeJS.Signals | number): boolean;
  once(event: 'error' | 'exit', listener: (...args: unknown[]) => void): this;
  stderr: NodeJS.ReadableStream | null;
  stdout: NodeJS.ReadableStream | null;
}

export interface FirefoxDriverManagerOptions {
  environment?: NodeJS.ProcessEnv;
  fetchImplementation?: typeof fetch;
  managedEnvironment?: (
    config: FirefoxAutomationRuntimeConfig,
    environment?: NodeJS.ProcessEnv,
  ) => Promise<boolean>;
  onDisconnect?: (readiness: WebDriverReadinessMessage) => void;
  spawnDriver?: (command: string, args: string[]) => DriverProcess;
}

export interface FirefoxDriverResponse {
  body: unknown;
  status: number;
}

function readiness(
  ready: boolean,
  reason: FirefoxAutomationReadinessReason,
  message: string,
): WebDriverReadinessMessage {
  return {
    type: 'webdriver.readiness',
    protocol: PANERELAY_PROTOCOL_VERSION,
    ready,
    reason,
    message,
  };
}

export function geckodriverConnectExistingArguments(marionettePort: number): string[] {
  return [
    '--host',
    '127.0.0.1',
    '--port',
    '0',
    '--connect-existing',
    '--marionette-host',
    '127.0.0.1',
    '--marionette-port',
    String(marionettePort),
    '--log',
    'error',
  ];
}

export function parseGeckodriverListeningPort(output: string): number | undefined {
  const match = /Listening on 127\.0\.0\.1:(\d{1,5})(?:\s|$)/.exec(output);
  const port = match ? Number(match[1]) : 0;
  return port >= 1 && port <= 65_535 ? port : undefined;
}

export class FirefoxDriverManager {
  private readonly fetchImplementation: typeof fetch;
  private readonly managedEnvironment: NonNullable<
    FirefoxDriverManagerOptions['managedEnvironment']
  >;
  private readonly spawnDriver: NonNullable<FirefoxDriverManagerOptions['spawnDriver']>;
  private process: DriverProcess | null = null;
  private endpoint: string | null = null;
  private realSessionId: string | null = null;
  private starting: Promise<WebDriverReadinessMessage> | null = null;
  private closing = false;

  constructor(
    private readonly config: FirefoxAutomationRuntimeConfig,
    private readonly options: FirefoxDriverManagerOptions = {},
  ) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.managedEnvironment = options.managedEnvironment ?? isManagedFirefoxEnvironment;
    this.spawnDriver =
      options.spawnDriver ??
      ((command, args) =>
        spawn(command, args, {
          env: options.environment ?? process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        }));
  }

  get ready(): boolean {
    return Boolean(this.process && this.endpoint && this.realSessionId);
  }

  get sessionId(): string {
    if (!this.realSessionId) throw new Error('Firefox WebDriver session is not ready');
    return this.realSessionId;
  }

  async ensureReady(): Promise<WebDriverReadinessMessage> {
    if (this.ready) return readiness(true, 'ready', 'Firefox WebDriver automation is ready');
    if (this.starting) return this.starting;
    this.starting = this.start().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    timeoutMs = DRIVER_REQUEST_TIMEOUT_MS,
  ): Promise<FirefoxDriverResponse> {
    if (!this.endpoint || !this.process) throw new Error('Firefox WebDriver is disconnected');
    const response = await this.fetchImplementation(`${this.endpoint}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_DRIVER_RESPONSE_BYTES) {
      throw new Error('Firefox WebDriver response exceeded the Panerelay size limit');
    }
    let parsed: unknown = {};
    if (bytes.byteLength > 0) {
      try {
        parsed = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        throw new Error('Firefox WebDriver returned an invalid JSON response');
      }
    }
    return { status: response.status, body: parsed };
  }

  async close(): Promise<void> {
    this.closing = true;
    const child = this.process;
    this.process = null;
    this.endpoint = null;
    this.realSessionId = null;
    if (child) child.kill('SIGTERM');
    this.closing = false;
  }

  private async start(): Promise<WebDriverReadinessMessage> {
    if (!this.config.firefoxPath) {
      return readiness(false, 'firefox-unavailable', 'Firefox is not configured');
    }
    if (!this.config.geckodriverPath) {
      return readiness(false, 'geckodriver-unavailable', 'geckodriver is not configured');
    }
    if (!this.config.managedToken) {
      return readiness(
        false,
        'launcher-unavailable',
        'Run Panerelay setup to install the Firefox automation launcher',
      );
    }
    if (!(await this.managedEnvironment(this.config, this.options.environment ?? process.env))) {
      return readiness(
        false,
        'managed-restart-required',
        'Close Firefox and reopen it with the Panerelay Firefox launcher',
      );
    }

    try {
      const port = await this.spawnAndReadPort();
      this.endpoint = `http://127.0.0.1:${port}`;
      const status = await this.request('GET', '/status');
      if (status.status < 200 || status.status >= 300) {
        throw new Error(`geckodriver health check returned ${status.status}`);
      }
      const created = await this.request('POST', '/session', {
        capabilities: { alwaysMatch: { browserName: 'firefox' } },
      });
      const sessionId = this.sessionIdFromResponse(created.body);
      if (created.status < 200 || created.status >= 300 || !sessionId) {
        throw new Error('geckodriver did not create an existing Firefox session');
      }
      this.realSessionId = sessionId;
      return readiness(true, 'ready', 'Firefox WebDriver automation is ready');
    } catch (error) {
      await this.close();
      return readiness(
        false,
        'driver-start-failed',
        error instanceof Error ? error.message : 'Firefox WebDriver could not start',
      );
    }
  }

  private spawnAndReadPort(): Promise<number> {
    const child = this.spawnDriver(
      this.config.geckodriverPath!,
      geckodriverConnectExistingArguments(this.config.marionettePort),
    );
    this.process = child;
    this.closing = false;
    child.once('exit', () => this.handleDriverExit(child));

    return new Promise<number>((resolve, reject) => {
      let output = '';
      let settled = false;
      const finish = (error?: Error, port?: number): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(port!);
      };
      const append = (chunk: unknown): void => {
        output = `${output}${String(chunk)}`.slice(-8_192);
        const port = parseGeckodriverListeningPort(output);
        if (port) finish(undefined, port);
      };
      child.stdout?.on('data', append);
      child.stderr?.on('data', append);
      child.once('error', error =>
        finish(error instanceof Error ? error : new Error(String(error))),
      );
      child.once('exit', code => {
        if (!settled) finish(new Error(`geckodriver exited before readiness (${String(code)})`));
      });
      const timer = setTimeout(
        () => finish(new Error('Timed out waiting for geckodriver readiness')),
        DRIVER_START_TIMEOUT_MS,
      );
      timer.unref();
    });
  }

  private sessionIdFromResponse(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const root = value as Record<string, unknown>;
    const body =
      root.value && typeof root.value === 'object'
        ? (root.value as Record<string, unknown>)
        : undefined;
    const sessionId = body?.sessionId ?? root.sessionId;
    return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : undefined;
  }

  private handleDriverExit(child: DriverProcess): void {
    if (this.process !== child) return;
    this.process = null;
    this.endpoint = null;
    this.realSessionId = null;
    if (this.closing) return;
    this.options.onDisconnect?.(
      readiness(
        false,
        'driver-disconnected',
        'geckodriver disconnected; restart Firefox with the Panerelay launcher',
      ),
    );
  }
}
