import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ClaudeMcpServer } from './cli.js';

const MAX_REQUEST_BYTES = 64 * 1024;
const MCP_PROTOCOL_VERSION = '2025-06-18';
const PERMISSION_SERVER_NAME = 'panerelay_permission';
const PERMISSION_TOOL_NAME = 'approve';

type JsonRpcId = number | string;

interface JsonRpcRequest {
  id?: JsonRpcId;
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface ClaudePermissionToolRequest {
  input: Record<string, unknown>;
  toolName: string;
  toolUseId?: string;
}

export type ClaudePermissionToolResult =
  | {
      behavior: 'allow';
      updatedInput: Record<string, unknown>;
    }
  | {
      behavior: 'deny';
      interrupt?: boolean;
      message: string;
    };

export type ClaudePermissionHandler = (
  request: ClaudePermissionToolRequest,
  signal: AbortSignal,
) => Promise<ClaudePermissionToolResult>;

export interface ClaudePermissionServer {
  close(): Promise<void>;
  mcpServer: ClaudeMcpServer;
  toolName: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sendEmpty(response: ServerResponse, statusCode: number): void {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': '0',
  });
  response.end();
}

function sendJson(response: ServerResponse, statusCode: number, body: object): void {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
    'Content-Type': 'application/json',
  });
  response.end(payload);
}

function rpcResult(id: JsonRpcId, result: object): object {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: JsonRpcId | null, code: number, message: string): object {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function readRequestBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    length += buffer.length;
    if (length > MAX_REQUEST_BYTES) throw new Error('MCP request body is too large');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function permissionTool() {
  return {
    name: PERMISSION_TOOL_NAME,
    title: 'Panerelay permission approval',
    description: 'Requests one user decision for a pending Claude Code tool call.',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description: 'The Claude Code tool requesting permission.',
        },
        input: {
          type: 'object',
          description: 'The original input for the pending tool call.',
          additionalProperties: true,
        },
        tool_use_id: {
          type: 'string',
          description: 'The pending Claude Code tool-use identifier.',
        },
      },
      required: ['tool_name', 'input'],
      additionalProperties: true,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  };
}

function validRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.jsonrpc === '2.0' &&
    typeof record.method === 'string' &&
    (record.id === undefined ||
      typeof record.id === 'string' ||
      (typeof record.id === 'number' && Number.isFinite(record.id)))
  );
}

export async function createClaudePermissionServer(
  handler: ClaudePermissionHandler,
): Promise<ClaudePermissionServer> {
  const path = `/${randomUUID()}/mcp`;
  const activeCalls = new Map<JsonRpcId, AbortController>();
  let closed = false;

  const server: Server = createServer((request, response) => {
    void handleRequest(request, response).catch(() => {
      if (!response.headersSent && !response.destroyed) sendEmpty(response, 500);
      else if (!response.destroyed) response.destroy();
    });
  });
  server.requestTimeout = 0;
  server.headersTimeout = 10_000;

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.url !== path) {
      sendEmpty(response, 404);
      return;
    }
    if (request.headers.origin !== undefined) {
      sendEmpty(response, 403);
      return;
    }
    if (request.method === 'GET') {
      response.setHeader('Allow', 'POST');
      sendEmpty(response, 405);
      return;
    }
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      sendEmpty(response, 405);
      return;
    }
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      sendEmpty(response, 415);
      return;
    }

    let body: unknown;
    try {
      body = await readRequestBody(request);
    } catch (error) {
      sendJson(
        response,
        error instanceof Error && error.message.includes('too large') ? 413 : 400,
        rpcError(null, -32700, 'Invalid JSON request'),
      );
      return;
    }
    if (!validRequest(body)) {
      sendJson(response, 400, rpcError(null, -32600, 'Invalid JSON-RPC request'));
      return;
    }

    const { id, method } = body;
    if (id === undefined) {
      if (method === 'notifications/cancelled') {
        const requestId = asRecord(body.params).requestId;
        if (typeof requestId === 'string' || typeof requestId === 'number') {
          activeCalls.get(requestId)?.abort('Claude Code cancelled the permission request');
        }
      }
      sendEmpty(response, 202);
      return;
    }

    if (method === 'initialize') {
      sendJson(
        response,
        200,
        rpcResult(id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'Panerelay permission server', version: '1.0.0' },
        }),
      );
      return;
    }
    if (method === 'ping') {
      sendJson(response, 200, rpcResult(id, {}));
      return;
    }
    if (method === 'tools/list') {
      sendJson(response, 200, rpcResult(id, { tools: [permissionTool()] }));
      return;
    }
    if (method !== 'tools/call') {
      sendJson(response, 200, rpcError(id, -32601, 'Unsupported MCP method'));
      return;
    }

    const params = asRecord(body.params);
    const args = asRecord(params.arguments);
    const toolName = args.tool_name;
    const input = args.input;
    const toolUseId = args.tool_use_id;
    if (
      params.name !== PERMISSION_TOOL_NAME ||
      typeof toolName !== 'string' ||
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      (toolUseId !== undefined && typeof toolUseId !== 'string')
    ) {
      sendJson(response, 200, rpcError(id, -32602, 'Invalid permission tool arguments'));
      return;
    }
    if (activeCalls.has(id)) {
      sendJson(response, 200, rpcError(id, -32600, 'Duplicate JSON-RPC request ID'));
      return;
    }

    const controller = new AbortController();
    activeCalls.set(id, controller);
    const abortOnDisconnect = (): void => {
      if (!response.writableEnded) controller.abort('Permission client disconnected');
    };
    response.once('close', abortOnDisconnect);
    try {
      const result = await handler(
        {
          input: input as Record<string, unknown>,
          toolName,
          ...(typeof toolUseId === 'string' ? { toolUseId } : {}),
        },
        controller.signal,
      );
      if (!response.destroyed) {
        sendJson(
          response,
          200,
          rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(result) }] }),
        );
      }
    } catch {
      if (!response.destroyed) {
        sendJson(response, 200, rpcError(id, -32603, 'Permission request failed closed'));
      }
    } finally {
      response.off('close', abortOnDisconnect);
      activeCalls.delete(id);
    }
  }

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen({ host: '127.0.0.1', port: 0 });
  });
  const address = server.address() as AddressInfo;

  return {
    toolName: `mcp__${PERMISSION_SERVER_NAME}__${PERMISSION_TOOL_NAME}`,
    mcpServer: {
      type: 'http',
      url: `http://127.0.0.1:${address.port}${path}`,
      alwaysLoad: true,
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const controller of activeCalls.values()) {
        controller.abort('Permission server closed');
      }
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) reject(error);
          else resolve();
        });
        server.closeIdleConnections();
      });
    },
  };
}
