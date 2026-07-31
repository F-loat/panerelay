import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createClaudePermissionServer,
  type ClaudePermissionToolRequest,
  type ClaudePermissionToolResult,
} from './claude-permission-server.js';

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  throw new Error('Timed out waiting for permission server request');
}

async function post(
  url: string,
  body: object,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test('serves the bounded MCP lifecycle and returns a JSON-stringified approval', async t => {
  let request: ClaudePermissionToolRequest | undefined;
  let resolveDecision: ((decision: ClaudePermissionToolResult) => void) | undefined;
  const server = await createClaudePermissionServer(
    received =>
      new Promise(resolve => {
        request = received;
        resolveDecision = resolve;
      }),
  );
  t.after(() => server.close());
  assert.equal(server.toolName, 'mcp__panerelay_permission__approve');
  assert.equal(server.mcpServer.type, 'http');
  if (server.mcpServer.type !== 'http') throw new Error('Expected HTTP MCP config');
  assert.equal(server.mcpServer.alwaysLoad, true);
  const url = server.mcpServer.url;

  const initialized = await post(url, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    },
  });
  assert.equal(initialized.status, 200);
  assert.equal((await initialized.json()).result.protocolVersion, '2025-06-18');

  const notification = await post(url, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  });
  assert.equal(notification.status, 202);

  const listed = await post(url, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  });
  const listedBody = await listed.json();
  assert.equal(listedBody.result.tools[0].name, 'approve');
  assert.deepEqual(listedBody.result.tools[0].inputSchema.required, ['tool_name', 'input']);

  const called = post(url, {
    jsonrpc: '2.0',
    id: 'permission-1',
    method: 'tools/call',
    params: {
      name: 'approve',
      arguments: {
        tool_name: 'Bash',
        input: { command: 'git status' },
        tool_use_id: 'tool-1',
      },
    },
  });
  await waitFor(() => request !== undefined);
  assert.deepEqual(request, {
    toolName: 'Bash',
    input: { command: 'git status' },
    toolUseId: 'tool-1',
  });
  resolveDecision?.({
    behavior: 'allow',
    updatedInput: request?.input ?? {},
  });
  const calledBody = await (await called).json();
  assert.deepEqual(JSON.parse(calledBody.result.content[0].text), {
    behavior: 'allow',
    updatedInput: { command: 'git status' },
  });
});

test('rejects browser origins and aborts a pending permission on MCP cancellation', async t => {
  let aborted = false;
  let started = false;
  const server = await createClaudePermissionServer(
    (_request, signal) =>
      new Promise(resolve => {
        started = true;
        signal.addEventListener(
          'abort',
          () => {
            aborted = true;
            resolve({
              behavior: 'deny',
              message: 'Permission request cancelled',
              interrupt: true,
            });
          },
          { once: true },
        );
      }),
  );
  t.after(() => server.close());
  if (server.mcpServer.type !== 'http') throw new Error('Expected HTTP MCP config');
  const url = server.mcpServer.url;

  const browserRequest = await post(
    url,
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    { Origin: 'https://attacker.example' },
  );
  assert.equal(browserRequest.status, 403);

  const called = post(url, {
    jsonrpc: '2.0',
    id: 'permission-cancel',
    method: 'tools/call',
    params: {
      name: 'approve',
      arguments: {
        tool_name: 'Write',
        input: { file_path: '/tmp/example' },
      },
    },
  });
  await waitFor(() => started);
  const cancelled = await post(url, {
    jsonrpc: '2.0',
    method: 'notifications/cancelled',
    params: { requestId: 'permission-cancel', reason: 'turn interrupted' },
  });
  assert.equal(cancelled.status, 202);
  assert.equal(aborted, true);
  const result = await (await called).json();
  assert.equal(JSON.parse(result.result.content[0].text).behavior, 'deny');
});
