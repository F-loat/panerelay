import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { delimiter, dirname } from 'node:path';
import { createInterface, type Interface } from 'node:readline';
import { resolveSpawnCommand } from './platform.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export interface CodexRpcMessage {
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
}

export interface CodexAppServerOptions {
  codexPath: string;
  pathEntries?: string[];
  onNotification: (message: CodexRpcMessage) => void;
  onServerRequest: (message: CodexRpcMessage & { id: number | string; method: string }) => void;
  onUnavailable: (message: string) => void;
  requestTimeoutMs?: number;
}

export class CodexAppServer {
  private process: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private nextId = 1;
  private readonly pending = new Map<number | string, PendingRequest>();
  private startPromise: Promise<void> | null = null;
  private stderrTail = '';

  constructor(private readonly options: CodexAppServerOptions) {}

  async start(): Promise<void> {
    if (this.process) return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = this.launch();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async request(method: string, params: unknown = {}): Promise<unknown> {
    await this.start();
    const id = this.nextId++;
    const timeoutMs = this.options.requestTimeoutMs ?? 30_000;
    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server timed out handling ${method}`));
      }, timeoutMs);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
    });
    this.send({ id, method, params });
    return result;
  }

  respond(id: number | string, result: unknown): void {
    this.send({ id, result });
  }

  async close(): Promise<void> {
    const child = this.process;
    this.process = null;
    this.lines?.close();
    this.lines = null;
    if (!child || child.exitCode !== null) return;

    await new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 1_000);
      timer.unref();
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  }

  private async launch(): Promise<void> {
    const runtimePath = [
      dirname(this.options.codexPath),
      ...(this.options.pathEntries ?? []),
      process.env.PATH,
    ]
      .filter((entry): entry is string => Boolean(entry))
      .join(delimiter);
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: runtimePath,
    };
    const launch = resolveSpawnCommand(
      this.options.codexPath,
      ['app-server', '--stdio'],
      process.platform,
      environment.ComSpec,
    );
    const child = spawn(launch.command, launch.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: environment,
      windowsHide: true,
    });
    this.process = child;
    this.stderrTail = '';
    this.lines = createInterface({ input: child.stdout });
    this.lines.on('line', line => this.handleLine(line));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-4_096);
    });
    child.once('error', error => this.handleExit(error.message));
    child.once('exit', (code, signal) => {
      const detail = this.stderrTail.trim();
      this.handleExit(
        `Codex app-server exited${code === null ? '' : ` with code ${code}`}${
          signal ? ` (${signal})` : ''
        }${detail ? `: ${detail}` : ''}`,
      );
    });

    await this.rawRequest('initialize', {
      clientInfo: {
        name: 'panerelay',
        title: 'Panerelay',
        version: '0.0.1',
      },
    });
    this.send({ method: 'initialized', params: {} });
  }

  private rawRequest(method: string, params: unknown): Promise<unknown> {
    const id = 0;
    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Codex app-server initialization timed out'));
      }, this.options.requestTimeoutMs ?? 30_000);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
    });
    this.send({ id, method, params });
    return result;
  }

  private send(message: CodexRpcMessage): void {
    const child = this.process;
    if (!child || child.stdin.destroyed) {
      throw new Error('Codex app-server is not running');
    }
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    let message: CodexRpcMessage;
    try {
      message = JSON.parse(line) as CodexRpcMessage;
    } catch {
      return;
    }

    if (message.id !== undefined && (message.result !== undefined || message.error)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new Error(message.error.message || 'Codex app-server request failed'));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.id !== undefined && message.method) {
      this.options.onServerRequest(
        message as CodexRpcMessage & { id: number | string; method: string },
      );
      return;
    }
    if (message.method) this.options.onNotification(message);
  }

  private handleExit(message: string): void {
    if (!this.process) return;
    this.process = null;
    this.lines?.close();
    this.lines = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
    }
    this.pending.clear();
    this.options.onUnavailable(message);
  }
}
