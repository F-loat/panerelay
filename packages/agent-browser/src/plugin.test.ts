import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  conversationTargetSessionName,
  PANERELAY_PROTOCOL_VERSION,
  type BridgeState,
} from '@panerelay/protocol';
import {
  PANERELAY_BROWSER_DEFAULT_PATH_ENV,
  PANERELAY_BROWSER_REGISTRY_PATH_ENV,
  setBrowserDefault,
  writeBrowserRegistration,
} from '@panerelay/browser-registry';
import { AGENT_BROWSER_PLUGIN_PROTOCOL, handlePluginRequest } from './plugin.js';

test('publishes the browser provider manifest', async () => {
  const response = await handlePluginRequest({
    protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
    type: 'plugin.manifest',
    capability: 'plugin.manifest',
  });

  assert.equal(response.success, true);
  assert.deepEqual(response.manifest, {
    name: 'panerelay',
    capabilities: ['browser.provider'],
    description:
      "Connect agent-browser to a user's selected authorized Chrome or Edge browser through Panerelay.",
  });
});

test('creates and releases a browser-level relay session through live Bridge state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-provider-'));
  const previousRegistryPath = process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV];
  const previousDefaultPath = process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV];
  process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV] = join(directory, 'browsers');
  process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV] = join(directory, 'browser-default.json');
  const requests: Array<{
    method?: string;
    url?: string;
    authorization?: string;
    body?: unknown;
  }> = [];
  const server = createServer((request, response) => {
    const recorded: (typeof requests)[number] = {
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
    };
    requests.push(recorded);
    if (request.method === 'POST' && request.url === '/sessions') {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        recorded.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            protocol: PANERELAY_PROTOCOL_VERSION,
            sessionId: 'relay-session-1',
            cdpUrl: 'ws://127.0.0.1:43123/cdp?session=relay-session-1&token=session-token',
            connectExpiresAt: '2026-07-29T08:00:00.000Z',
          }),
        );
      });
      return;
    }
    if (request.method === 'DELETE' && request.url === '/sessions/relay-session-1') {
      response.writeHead(204);
      response.end();
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
    server.listen(0, '127.0.0.1');
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const state: BridgeState = {
    protocol: PANERELAY_PROTOCOL_VERSION,
    pid: process.pid,
    port: address.port,
    token: 'test token',
    generation: 'generation-test',
    browserId: 'browser-1',
    browserName: 'Test Chrome',
    extensionVersion: '0.0.1',
    extensionId: 'extension-1',
    updatedAt: new Date().toISOString(),
  };
  await writeBrowserRegistration(state);

  try {
    const response = await handlePluginRequest({
      protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
      type: 'browser.launch',
      capability: 'browser.provider',
      request: { session: 'agent-session-1' },
    });

    assert.equal(response.success, true);
    assert.deepEqual(response.browser, {
      cdpUrl: 'ws://127.0.0.1:43123/cdp?session=relay-session-1&token=session-token',
      directPage: false,
      metadata: {
        browserId: 'browser-1',
        browserName: 'Test Chrome',
        extensionVersion: '0.0.1',
        relaySessionId: 'relay-session-1',
        connectExpiresAt: '2026-07-29T08:00:00.000Z',
      },
      cleanup: {
        bridgePid: process.pid,
        browserId: 'browser-1',
        sessionId: 'relay-session-1',
      },
    });
    assert.deepEqual(requests[0], {
      method: 'POST',
      url: '/sessions',
      authorization: 'Bearer test token',
      body: {
        protocol: PANERELAY_PROTOCOL_VERSION,
        actor: {
          kind: 'automation',
          name: 'agent-browser',
          sessionLabel: 'agent-session-1',
        },
      },
    });

    await writeBrowserRegistration({
      ...state,
      port: 9,
      token: 'edge token',
      generation: 'generation-edge',
      browserId: 'browser-2',
      browserName: 'Test Edge',
      browserFamily: 'edge',
    });
    await setBrowserDefault('browser-2');

    const closeResponse = await handlePluginRequest({
      protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
      type: 'browser.close',
      capability: 'browser.provider',
      request: {
        bridgePid: process.pid,
        browserId: 'browser-1',
        sessionId: 'relay-session-1',
      },
    });
    assert.equal(closeResponse.success, true);
    assert.deepEqual(requests[1], {
      method: 'DELETE',
      url: '/sessions/relay-session-1',
      authorization: 'Bearer test token',
    });
  } finally {
    if (previousRegistryPath === undefined) {
      delete process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV];
    } else {
      process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV] = previousRegistryPath;
    }
    if (previousDefaultPath === undefined) {
      delete process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV];
    } else {
      process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV] = previousDefaultPath;
    }
    await rm(directory, { recursive: true, force: true });
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('binds a reserved conversation session to its exact browser and target hint', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-provider-target-'));
  const previousRegistryPath = process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV];
  const previousDefaultPath = process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV];
  process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV] = join(directory, 'browsers');
  process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV] = join(directory, 'browser-default.json');
  const target = {
    browserId: '11111111-1111-4111-8111-111111111111',
    targetId: '22222222-2222-4222-8222-222222222222',
  };
  let body: unknown;
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/sessions') {
      response.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          protocol: PANERELAY_PROTOCOL_VERSION,
          sessionId: 'targeted-session',
          cdpUrl: 'ws://127.0.0.1:43123/cdp?session=targeted-session&token=token',
          connectExpiresAt: '2026-07-29T08:00:00.000Z',
        }),
      );
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
    server.listen(0, '127.0.0.1');
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseState: BridgeState = {
    protocol: PANERELAY_PROTOCOL_VERSION,
    pid: process.pid,
    port: address.port,
    token: 'target token',
    generation: 'generation-target',
    browserId: target.browserId,
    browserName: 'Target Chrome',
    extensionVersion: '0.0.1',
    extensionId: 'extension-1',
    updatedAt: new Date().toISOString(),
  };

  try {
    await writeBrowserRegistration(baseState);
    await writeBrowserRegistration({
      ...baseState,
      port: 9,
      token: 'wrong token',
      generation: 'generation-wrong',
      browserId: '33333333-3333-4333-8333-333333333333',
      browserName: 'Default Edge',
    });
    await setBrowserDefault('33333333-3333-4333-8333-333333333333');

    const response = await handlePluginRequest({
      protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
      type: 'browser.launch',
      capability: 'browser.provider',
      request: { session: conversationTargetSessionName(target) },
    });

    assert.equal(response.success, true);
    assert.deepEqual(body, {
      protocol: PANERELAY_PROTOCOL_VERSION,
      actor: {
        kind: 'automation',
        name: 'agent-browser',
        sessionLabel: conversationTargetSessionName(target),
      },
      initialTargetId: target.targetId,
    });
    assert.equal(
      (response.browser as { metadata?: { browserId?: string } }).metadata?.browserId,
      target.browserId,
    );
  } finally {
    if (previousRegistryPath === undefined) {
      delete process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV];
    } else {
      process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV] = previousRegistryPath;
    }
    if (previousDefaultPath === undefined) {
      delete process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV];
    } else {
      process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV] = previousDefaultPath;
    }
    await rm(directory, { recursive: true, force: true });
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('rejects malformed reserved conversation sessions before browser selection', async () => {
  const response = await handlePluginRequest({
    protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
    type: 'browser.launch',
    capability: 'browser.provider',
    request: { session: 'panerelay-tab-v1-not-a-valid-target' },
  });

  assert.equal(response.success, false);
  assert.match(String(response.error), /malformed or unsupported/);
});

test('fails before contacting the Bridge when the browser explicitly lacks CDP support', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-provider-unsupported-'));
  const previousRegistryPath = process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV];
  const previousDefaultPath = process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV];
  process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV] = join(directory, 'browsers');
  process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV] = join(directory, 'browser-default.json');
  const state: BridgeState = {
    protocol: PANERELAY_PROTOCOL_VERSION,
    pid: process.pid,
    port: 9,
    token: 'unused',
    generation: 'generation-unused',
    browserId: 'unsupported-1',
    browserName: 'Unsupported browser',
    browserFamily: 'unknown',
    capabilities: { cdpRelay: false },
    extensionVersion: '0.2.0',
    extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    updatedAt: new Date().toISOString(),
  };
  await writeBrowserRegistration(state);

  try {
    const response = await handlePluginRequest({
      protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
      type: 'browser.launch',
      capability: 'browser.provider',
      request: { session: 'agent-session-1' },
    });

    assert.equal(response.success, false);
    assert.match(String(response.error), /provide a CDP relay/);
  } finally {
    if (previousRegistryPath === undefined) {
      delete process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV];
    } else {
      process.env[PANERELAY_BROWSER_REGISTRY_PATH_ENV] = previousRegistryPath;
    }
    if (previousDefaultPath === undefined) {
      delete process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV];
    } else {
      process.env[PANERELAY_BROWSER_DEFAULT_PATH_ENV] = previousDefaultPath;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
