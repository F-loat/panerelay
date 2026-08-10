import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  PANERELAY_FETCH_ADAPTER_MAX_OUTPUT_BYTES,
  PANERELAY_FETCH_ADAPTER_MAX_STDERR_BYTES,
  PANERELAY_FETCH_ADAPTER_PROTOCOL,
  isFetchAdapterInvocationResponse,
  serializeFetchAdapterMessage,
  type FetchAdapterInvocationRequest,
  type FetchAdapterInvocationResponse,
  type FetchAdapterInvocationArtifact,
  type FetchAdapterRegistration,
} from '@panerelay/protocol';
import type { ActiveBrowserFetchSession } from './browser-fetch-client.js';

const DEFAULT_ADAPTER_TIMEOUT_MS = 120_000;

export interface FetchAdapterDispatchOptions {
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  artifacts?: FetchAdapterInvocationArtifact[];
}

export class FetchAdapterCommandError extends Error {
  constructor(
    readonly code: NonNullable<FetchAdapterInvocationResponse['error']>['code'],
    message: string,
    readonly retryable?: boolean,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'FetchAdapterCommandError';
  }
}

function minimalEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const name of [
    'PATH',
    'SystemRoot',
    'SYSTEMROOT',
    'WINDIR',
    'ComSpec',
    'TEMP',
    'TMP',
    'TMPDIR',
  ]) {
    if (source[name] !== undefined) result[name] = source[name];
  }
  return result;
}

function redact(value: string, secrets: string[]): string {
  return secrets.reduce(
    (current, secret) => (secret ? current.replaceAll(secret, '[redacted]') : current),
    value,
  );
}

export async function dispatchFetchAdapter(
  registration: FetchAdapterRegistration,
  active: ActiveBrowserFetchSession,
  command: string,
  args: Record<string, string | number | boolean>,
  options: FetchAdapterDispatchOptions = {},
): Promise<unknown> {
  const request: FetchAdapterInvocationRequest = {
    protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
    requestId: randomUUID(),
    operation: 'execute',
    command,
    args,
    ...(options.artifacts ? { artifacts: options.artifacts } : {}),
    fetch: {
      endpoint: active.session.endpoint,
      token: active.session.token,
      expiresAt: active.session.expiresAt,
    },
  };
  const serialized = serializeFetchAdapterMessage(request);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [registration.executablePath], {
      env: minimalEnvironment(options.environment ?? process.env),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    let outputBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    const fail = (message: string): void => {
      child.kill('SIGKILL');
      finish(() => reject(new Error(message)));
    };
    const timer = setTimeout(
      () => fail('Fetch adapter timed out'),
      options.timeoutMs ?? DEFAULT_ADAPTER_TIMEOUT_MS,
    );
    timer.unref();

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > PANERELAY_FETCH_ADAPTER_MAX_OUTPUT_BYTES) {
        fail('Fetch adapter response exceeded the protocol limit');
        return;
      }
      output += chunk;
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderrBytes += Buffer.byteLength(chunk);
      if (stderrBytes > PANERELAY_FETCH_ADAPTER_MAX_STDERR_BYTES) {
        fail('Fetch adapter diagnostic output exceeded the protocol limit');
      }
    });
    child.once('error', () =>
      finish(() => reject(new Error('Fetch adapter could not be started'))),
    );
    child.once('close', code => {
      if (settled) return;
      try {
        const response = JSON.parse(output.trim()) as unknown;
        if (
          code !== 0 ||
          !isFetchAdapterInvocationResponse(response) ||
          response.requestId !== request.requestId
        ) {
          throw new Error('invalid response');
        }
        if (!response.success) {
          const message = redact(response.error?.message ?? 'Fetch adapter failed', [
            active.session.token,
          ]);
          const code = response.error?.code ?? 'command-failed';
          finish(() =>
            reject(new FetchAdapterCommandError(code, message, response.error?.retryable)),
          );
          return;
        }
        finish(() => resolve(response.result));
      } catch {
        finish(() => reject(new Error('Fetch adapter returned an invalid response')));
      }
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(serialized);
  });
}
