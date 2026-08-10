import { randomUUID } from 'node:crypto';
import {
  PANERELAY_FETCH_ADAPTER_PROTOCOL,
  PANERELAY_FETCH_ADAPTER_MAX_INPUT_BYTES,
  isBrowserFetchResponse,
  isFetchAdapterInvocationRequest,
  serializeFetchAdapterMessage,
  type BrowserFetchRequest,
  type BrowserFetchResponse,
  type FetchAdapterInvocationRequest,
  type FetchAdapterInvocationResponse,
} from '@panerelay/protocol';
import type { SiteArtifact, SiteCommandContext, SiteCommandDefinition } from './definitions.js';
import { SiteError } from './helpers.js';

export interface SiteRuntimeDependencies {
  browserFetch?: (
    request: BrowserFetchRequest,
    invocation: FetchAdapterInvocationRequest,
  ) => Promise<BrowserFetchResponse>;
}

function relayFailure(status: number, detail: string): SiteError {
  if (/localStorage/i.test(detail)) {
    return new SiteError(
      'missing-credential',
      'Required browser localStorage state is unavailable',
    );
  }
  if (/timed out|timeout/i.test(detail)) {
    return new SiteError('upstream-failure', 'Browser-backed request timed out', true);
  }
  if (status === 429) {
    return new SiteError('upstream-failure', 'Browser fetch relay is busy', true);
  }
  if (status >= 500) {
    return new SiteError('upstream-failure', 'Browser-backed request failed', true);
  }
  return new SiteError('command-failed', 'Browser fetch relay rejected the request');
}

async function relayFetch(
  request: BrowserFetchRequest,
  invocation: FetchAdapterInvocationRequest,
): Promise<BrowserFetchResponse> {
  const response = await fetch(invocation.fetch.endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${invocation.fetch.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  const text = await response.text();
  if (!response.ok) {
    let detail = `Bridge HTTP ${response.status}`;
    try {
      const value = JSON.parse(text) as unknown;
      if (
        value &&
        typeof value === 'object' &&
        typeof (value as { error?: unknown }).error === 'string'
      ) {
        detail = (value as { error: string }).error;
      }
    } catch {
      // Retain the bounded status-only error.
    }
    throw relayFailure(
      response.status,
      detail.replaceAll(invocation.fetch.token, '[redacted]').slice(0, 2_048),
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Panerelay Bridge returned invalid JSON');
  }
  if (!isBrowserFetchResponse(value)) {
    throw new Error('Panerelay Bridge returned an invalid fetch response');
  }
  return value;
}

export async function executeSiteCommand(
  commands: readonly SiteCommandDefinition[],
  invocation: FetchAdapterInvocationRequest,
  dependencies: SiteRuntimeDependencies = {},
): Promise<unknown> {
  const command = commands.find(candidate => candidate.name === invocation.command);
  if (!command) throw new SiteError('invalid-input', `Unknown site command: ${invocation.command}`);
  const browserFetch = dependencies.browserFetch ?? relayFetch;
  const artifact = (argumentName: string): SiteArtifact => {
    const artifactId = invocation.args[argumentName];
    if (typeof artifactId !== 'string') {
      throw new SiteError('invalid-input', `Artifact argument is unavailable: ${argumentName}`);
    }
    const source = invocation.artifacts?.find(candidate => candidate.id === artifactId);
    if (!source) {
      throw new SiteError('invalid-input', `Artifact argument is unavailable: ${argumentName}`);
    }
    const bytes = Uint8Array.from(Buffer.from(source.data, 'base64'));
    if (bytes.length !== source.size) {
      throw new SiteError('invalid-input', `Artifact bytes are invalid: ${argumentName}`);
    }
    return {
      id: source.id,
      basename: source.basename,
      mediaType: source.mediaType,
      size: source.size,
      bytes,
    };
  };
  const context: SiteCommandContext = {
    invocation,
    fetch: request => browserFetch(request, invocation),
    artifact,
  };
  return command.run(context, invocation.args);
}

async function readInvocation(
  input: NodeJS.ReadableStream,
): Promise<FetchAdapterInvocationRequest> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of input) {
    const value =
      typeof chunk === 'string'
        ? Buffer.from(chunk)
        : Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as Uint8Array);
    length += value.length;
    if (length > PANERELAY_FETCH_ADAPTER_MAX_INPUT_BYTES) {
      throw new Error('Site adapter input exceeded the protocol limit');
    }
    chunks.push(value);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new Error('Site adapter input is not valid JSON');
  }
  if (!isFetchAdapterInvocationRequest(parsed)) throw new Error('Site adapter input is invalid');
  return parsed;
}

export async function runSiteAdapter(
  commands: readonly SiteCommandDefinition[],
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<void> {
  let requestId: string = randomUUID();
  let response: FetchAdapterInvocationResponse;
  try {
    const invocation = await readInvocation(input);
    requestId = invocation.requestId;
    response = {
      protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
      requestId,
      operation: 'execute',
      success: true,
      result: await executeSiteCommand(commands, invocation),
    };
  } catch (error) {
    const failure =
      error instanceof SiteError
        ? {
            code: error.code,
            message: error.message,
            ...(error.retryable === undefined ? {} : { retryable: error.retryable }),
          }
        : { code: 'command-failed' as const, message: 'Site command failed' };
    response = {
      protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
      requestId,
      operation: 'execute',
      success: false,
      error: failure,
    };
  }
  output.write(serializeFetchAdapterMessage(response));
}
