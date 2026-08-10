import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  PANERELAY_FETCH_PERMISSION_PROTOCOL,
  PANERELAY_PROTOCOL_VERSION,
  type BridgeState,
} from '@panerelay/protocol';
import { handleFetchMcpRequest, runFetchMcpServer } from './fetch-mcp-server.js';

const state: BridgeState = {
  protocol: PANERELAY_PROTOCOL_VERSION,
  pid: 1,
  port: 3210,
  token: 'bridge-token',
  generation: 'generation',
  browserId: 'browser',
  browserName: 'Chrome',
  extensionReleaseVersion: '0.8.0',
  extensionBuildVersion: '140.0.7339.1',
  hostVersion: '0.8.0',
  extensionId: 'extension',
  capabilities: { cdpRelay: true, browserFetch: true },
  updatedAt: new Date().toISOString(),
};

test('exposes one browser fetch tool and routes calls through a selected browser', async () => {
  const listed = await handleFetchMcpRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
  });
  assert.equal(
    (listed?.result as { tools: Array<{ name: string }> }).tools[0]?.name,
    'browser_fetch',
  );

  let authorizedDomain = '';
  let capturedCookies: boolean | undefined;
  const called = await handleFetchMcpRequest(
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'browser_fetch', arguments: { url: 'https://example.com/private' } },
    },
    {
      selectBrowser: async () => ({ source: 'single', state }),
      requestPermission: async (_state, domain) => {
        authorizedDomain = domain;
        return {
          protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
          granted: true,
          domain,
          scope: 'domain',
        };
      },
      runFetch: async (_state, request) => {
        capturedCookies = request.withCookies;
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: { ok: true },
          bodyType: 'json',
          url: request.url,
          redirected: false,
          attachedCookieCount: 2,
        };
      },
    },
  );
  assert.equal(authorizedDomain, 'example.com');
  assert.equal(capturedCookies, true);
  assert.deepEqual((called?.result as { structuredContent: unknown }).structuredContent, {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: { ok: true },
    bodyType: 'json',
    url: 'https://example.com/private',
    redirected: false,
    attachedCookieCount: 2,
  });
});

test('returns bounded tool errors for invalid input and denied domains', async () => {
  const invalid = await handleFetchMcpRequest({
    jsonrpc: '2.0',
    id: 'invalid',
    method: 'tools/call',
    params: { name: 'browser_fetch', arguments: { url: 'file:///etc/passwd' } },
  });
  assert.equal((invalid?.result as { isError: boolean }).isError, true);

  const denied = await handleFetchMcpRequest(
    {
      jsonrpc: '2.0',
      id: 'denied',
      method: 'tools/call',
      params: { name: 'browser_fetch', arguments: { url: 'https://example.com/' } },
    },
    {
      selectBrowser: async () => ({ source: 'single', state }),
      requestPermission: async () => ({
        protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
        granted: false,
        domain: 'example.com',
      }),
    },
  );
  assert.match(
    (denied?.result as { content: Array<{ text: string }> }).content[0]!.text,
    /permission was denied/,
  );
});

test('accepts cancellation while a tool call is in flight', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let rendered = '';
  output.setEncoding('utf8');
  output.on('data', chunk => {
    rendered += String(chunk);
  });
  const running = runFetchMcpServer({
    input,
    output,
    selectBrowser: async () => ({ source: 'single', state }),
    requestPermission: async () => ({
      protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
      granted: true,
      domain: 'example.com',
      scope: 'domain',
    }),
    runFetch: async (_state, _request, options) =>
      await new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        });
      }),
  });
  input.write(
    `${JSON.stringify({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'browser_fetch', arguments: { url: 'https://example.com/' } },
    })}\n`,
  );
  await new Promise(resolve => setImmediate(resolve));
  input.end(
    `${JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/cancelled',
      params: { requestId: 7, reason: 'test' },
    })}\n`,
  );
  await running;
  assert.deepEqual(JSON.parse(rendered), {
    jsonrpc: '2.0',
    id: 7,
    error: { code: -32800, message: 'Request cancelled' },
  });
});
