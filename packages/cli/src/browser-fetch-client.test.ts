import assert from 'node:assert/strict';
import test from 'node:test';
import type { BridgeState } from '@panerelay/protocol';
import { requestBrowserFetchPermission, runBrowserFetch } from './browser-fetch-client.js';

const state: BridgeState = {
  protocol: 'panerelay.relay.v2',
  pid: 123,
  port: 41_234,
  token: 'registration-secret',
  generation: 'generation-1',
  browserId: 'browser-1',
  browserName: 'Chrome',
  browserFamily: 'chrome',
  capabilities: { cdpRelay: true, browserFetch: true },
  extensionReleaseVersion: '0.8.0',
  extensionBuildVersion: '0.8.0.0',
  hostVersion: '0.8.0',
  extensionId: 'extension-id',
  updatedAt: new Date().toISOString(),
};

test('creates, uses, and releases one generation-bound fetch session', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const result = await runBrowserFetch(
    state,
    { url: 'https://example.test/value', headers: { Origin: 'https://example.test' } },
    {
      fetch: async (input, init) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.endsWith('/fetch/sessions') && init?.method === 'POST') {
          return Response.json(
            {
              protocol: 'panerelay.fetch-session.v3',
              sessionId: 'session-1',
              endpoint: 'http://127.0.0.1:41234/fetch',
              token: 'fetch-session-secret-token',
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
            { status: 201 },
          );
        }
        if (url.endsWith('/fetch')) {
          return Response.json({
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' },
            body: { ok: true },
            bodyType: 'json',
            url: 'https://example.test/value',
            redirected: false,
            attachedCookieCount: 1,
          });
        }
        return new Response(null, { status: 204 });
      },
    },
  );

  assert.deepEqual(result.body, { ok: true });
  assert.equal(calls.length, 3);
  assert.match(String(calls[0]?.init?.body), /generation-1/);
  assert.equal(
    (calls[1]?.init?.headers as Record<string, string>).authorization,
    'Bearer fetch-session-secret-token',
  );
  assert.equal(calls[2]?.init?.method, 'DELETE');
});

test('does not include bearer credentials in Bridge failures', async () => {
  await assert.rejects(
    runBrowserFetch(
      state,
      { url: 'https://example.test' },
      {
        fetch: async () =>
          Response.json(
            { protocol: 'panerelay.fetch-session.v3', error: 'generation changed' },
            { status: 409 },
          ),
      },
    ),
    error => {
      assert.doesNotMatch(String(error), /registration-secret/);
      assert.match(String(error), /generation changed/);
      return true;
    },
  );
});

test('requests one normalized domain permission with registration authority', async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const result = await requestBrowserFetchPermission(state, '*.example.test', {
    fetch: async (input, init) => {
      request = { url: String(input), init };
      return Response.json({
        protocol: 'panerelay.fetch-permission.v1',
        granted: true,
        domain: '*.example.test',
        scope: 'domain',
      });
    },
  });
  assert.equal(request?.url, 'http://127.0.0.1:41234/fetch/permissions');
  assert.equal(
    (request?.init?.headers as Record<string, string>).authorization,
    'Bearer registration-secret',
  );
  assert.match(String(request?.init?.body), /\*\.example\.test/);
  assert.equal(result.scope, 'domain');
});
