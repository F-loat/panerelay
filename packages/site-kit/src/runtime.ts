import { randomUUID } from 'node:crypto';
import {
  PANERELAY_FETCH_ADAPTER_PROTOCOL,
  isBrowserFetchResponse,
  isFetchAdapterInvocationRequest,
  serializeFetchAdapterMessage,
  type BrowserFetchRequest,
  type BrowserFetchResponse,
  type FetchAdapterInvocationRequest,
  type FetchAdapterInvocationResponse,
} from '@panerelay/protocol';
import type { SiteCommandContext, SiteCommandDefinition } from './definitions.js';

const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_ERROR_BYTES = 4_096;

export interface SiteRuntimeDependencies {
  browserFetch?: (
    request: BrowserFetchRequest,
    invocation: FetchAdapterInvocationRequest,
  ) => Promise<BrowserFetchResponse>;
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
    throw new Error(detail.replaceAll(invocation.fetch.token, '[redacted]').slice(0, 2_048));
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
  if (!command) throw new Error(`Unknown site command: ${invocation.command}`);
  const browserFetch = dependencies.browserFetch ?? relayFetch;
  const context: SiteCommandContext = {
    invocation,
    fetch: request => browserFetch(request, invocation),
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
    if (length > MAX_INPUT_BYTES) throw new Error('Site adapter input exceeded the protocol limit');
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
    response = {
      protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
      requestId,
      operation: 'execute',
      success: false,
      error: (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_BYTES),
    };
  }
  output.write(serializeFetchAdapterMessage(response));
}
