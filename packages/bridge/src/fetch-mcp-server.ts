import { Buffer } from 'node:buffer';
import type { Readable, Writable } from 'node:stream';
import { selectBrowserFetchRegistration, type BrowserSelection } from '@panerelay/browser-registry';
import {
  requestBrowserFetchPermission,
  runBrowserFetch,
} from '@panerelay/cli/browser-fetch-client';
import {
  browserFetchOriginForUrl,
  isBrowserFetchRequest,
  type BrowserFetchRequest,
  type BrowserFetchResponse,
} from '@panerelay/protocol';

const MCP_PROTOCOL_VERSION = '2025-06-18';
const MAX_INPUT_LINE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BODY_BYTES = 512 * 1024;

type JsonRpcId = number | string | null;

interface JsonRpcRequest {
  id?: JsonRpcId;
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

interface FetchMcpDependencies {
  requestPermission?: typeof requestBrowserFetchPermission;
  runFetch?: typeof runBrowserFetch;
  selectBrowser?: () => Promise<BrowserSelection>;
}

export interface FetchMcpServerOptions extends FetchMcpDependencies {
  input?: Readable;
  output?: Writable;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requestFromArguments(value: unknown): BrowserFetchRequest {
  const input = record(value);
  const request: BrowserFetchRequest = {
    url: typeof input.url === 'string' ? input.url : '',
    ...(input.method === undefined
      ? {}
      : { method: input.method as BrowserFetchRequest['method'] }),
    ...(input.headers === undefined
      ? {}
      : { headers: input.headers as BrowserFetchRequest['headers'] }),
    ...(input.query === undefined ? {} : { query: input.query as BrowserFetchRequest['query'] }),
    ...(input.body === undefined ? {} : { body: input.body as BrowserFetchRequest['body'] }),
    withCookies:
      input.withCookies === undefined
        ? true
        : (input.withCookies as BrowserFetchRequest['withCookies']),
    ...(input.responseType === undefined
      ? {}
      : { responseType: input.responseType as BrowserFetchRequest['responseType'] }),
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs as number }),
  };
  if (!isBrowserFetchRequest(request) || !browserFetchOriginForUrl(request.url)) {
    throw new Error('browser_fetch received an invalid or unbounded HTTP(S) request');
  }
  return request;
}

function boundedResponse(response: BrowserFetchResponse): Record<string, unknown> {
  const serialized =
    response.bodyType === 'json' ? JSON.stringify(response.body) : String(response.body);
  if (Buffer.byteLength(serialized) <= MAX_OUTPUT_BODY_BYTES) return { ...response };
  let bodyPreview = Buffer.from(serialized).subarray(0, MAX_OUTPUT_BODY_BYTES).toString('utf8');
  while (Buffer.byteLength(bodyPreview) > MAX_OUTPUT_BODY_BYTES)
    bodyPreview = bodyPreview.slice(0, -1);
  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    bodyType: response.bodyType,
    bodyPreview,
    bodyTruncated: true,
    url: response.url,
    redirected: response.redirected,
    attachedCookieCount: response.attachedCookieCount,
  };
}

async function executeBrowserFetch(
  args: unknown,
  dependencies: FetchMcpDependencies,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const request = requestFromArguments(args);
  const selection = await (dependencies.selectBrowser ?? selectBrowserFetchRegistration)();
  const permission = await (dependencies.requestPermission ?? requestBrowserFetchPermission)(
    selection.state,
    new URL(request.url).hostname,
    { signal },
  );
  if (!permission.granted) {
    throw new Error(`Browser fetch permission was denied for ${new URL(request.url).hostname}`);
  }
  return boundedResponse(
    await (dependencies.runFetch ?? runBrowserFetch)(selection.state, request, { signal }),
  );
}

function toolDefinition(): Record<string, unknown> {
  return {
    name: 'browser_fetch',
    title: 'Browser-authenticated fetch',
    description:
      'Send one bounded HTTP(S) request through the user-authorized Panerelay browser session. Browser cookies are attached by default but are never returned. Redirects fail closed. A new domain may require user approval in the Panerelay Extension.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['url'],
      properties: {
        url: { type: 'string', description: 'Absolute HTTP(S) URL.' },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Request headers. Cookie is forbidden and managed by Panerelay.',
        },
        query: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'value'],
            properties: { name: { type: 'string' }, value: { type: 'string' } },
          },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['encoding', 'data'],
          properties: {
            encoding: { type: 'string', enum: ['utf8', 'base64'] },
            data: { type: 'string' },
          },
        },
        withCookies: { type: 'boolean', default: true },
        responseType: { type: 'string', enum: ['auto', 'json', 'text', 'base64'] },
        timeoutMs: { type: 'integer', minimum: 100, maximum: 120000 },
      },
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  };
}

function result(id: JsonRpcId, value: unknown): Record<string, unknown> {
  return { jsonrpc: '2.0', id, result: value };
}

function rpcError(id: JsonRpcId, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export async function handleFetchMcpRequest(
  message: unknown,
  dependencies: FetchMcpDependencies = {},
  signal?: AbortSignal,
): Promise<Record<string, unknown> | undefined> {
  const request = record(message) as Partial<JsonRpcRequest>;
  if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return rpcError(request.id ?? null, -32600, 'Invalid Request');
  }
  if (request.id === undefined) return undefined;
  if (request.method === 'initialize') {
    return result(request.id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'panerelay-fetch', version: '0.8.0' },
    });
  }
  if (request.method === 'ping') return result(request.id, {});
  if (request.method === 'tools/list') return result(request.id, { tools: [toolDefinition()] });
  if (request.method !== 'tools/call') {
    return rpcError(request.id, -32601, `Method not found: ${request.method}`);
  }
  const params = record(request.params);
  if (params.name !== 'browser_fetch') {
    return rpcError(request.id, -32602, 'Unknown Panerelay fetch tool');
  }
  try {
    const response = await executeBrowserFetch(params.arguments, dependencies, signal);
    return result(request.id, {
      content: [{ type: 'text', text: JSON.stringify(response) }],
      structuredContent: response,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Panerelay browser fetch failed';
    return result(request.id, {
      content: [{ type: 'text', text: message.slice(0, 4_096) }],
      isError: true,
    });
  }
}

export async function runFetchMcpServer(options: FetchMcpServerOptions = {}): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  let pending = '';
  const controllers = new Map<string, AbortController>();
  const inFlight = new Set<Promise<void>>();
  let writes = Promise.resolve();
  const write = (message: Record<string, unknown>) => {
    writes = writes.then(
      () =>
        new Promise<void>((resolve, reject) => {
          output.write(`${JSON.stringify(message)}\n`, error => {
            if (error) reject(error);
            else resolve();
          });
        }),
    );
    return writes;
  };
  const dispatch = (parsed: unknown) => {
    const request = record(parsed);
    if (request.method === 'notifications/cancelled') {
      const requestId = record(request.params).requestId;
      if (typeof requestId === 'string' || typeof requestId === 'number') {
        controllers.get(JSON.stringify(requestId))?.abort();
      }
      return;
    }
    const requestId = request.id;
    const key =
      typeof requestId === 'string' || typeof requestId === 'number'
        ? JSON.stringify(requestId)
        : undefined;
    const controller = new AbortController();
    if (key) controllers.set(key, controller);
    const task = handleFetchMcpRequest(parsed, options, controller.signal)
      .then(async response => {
        if (controller.signal.aborted && requestId !== undefined) {
          await write(rpcError(requestId as JsonRpcId, -32800, 'Request cancelled'));
        } else if (response) {
          await write(response);
        }
      })
      .finally(() => {
        if (key && controllers.get(key) === controller) controllers.delete(key);
        inFlight.delete(task);
      });
    inFlight.add(task);
  };
  input.setEncoding('utf8');
  for await (const chunk of input) {
    pending += String(chunk);
    let newline = pending.indexOf('\n');
    while (newline >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, '');
      pending = pending.slice(newline + 1);
      if (line && Buffer.byteLength(line) <= MAX_INPUT_LINE_BYTES) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          await write(rpcError(null, -32700, 'Parse error'));
          newline = pending.indexOf('\n');
          continue;
        }
        dispatch(parsed);
      } else if (line) {
        await write(rpcError(null, -32600, 'Request exceeds input limit'));
      }
      newline = pending.indexOf('\n');
    }
    if (Buffer.byteLength(pending) > MAX_INPUT_LINE_BYTES) {
      await write(rpcError(null, -32600, 'Request exceeds input limit'));
      pending = '';
    }
  }
  for (const controller of controllers.values()) controller.abort();
  await Promise.allSettled([...inFlight]);
  await writes;
}
