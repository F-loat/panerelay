import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PANERELAY_PROTOCOL_VERSION, type BridgeState } from '@panerelay/protocol';
import { PANERELAY_STATE_PATH_ENV } from '@panerelay/protocol/node';
import {
  AGENT_BROWSER_PLUGIN_PROTOCOL,
  AGENT_BROWSER_WEBDRIVER_PROVIDER_CAPABILITY,
  handlePluginRequest,
} from './plugin.js';

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
    description: "Connect agent-browser to a user's authorized browser targets through Panerelay.",
  });
});

test('creates and releases a browser-level relay session through live Bridge state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-provider-'));
  const statePath = join(directory, 'bridge.json');
  const previousStatePath = process.env[PANERELAY_STATE_PATH_ENV];
  process.env[PANERELAY_STATE_PATH_ENV] = statePath;
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
            transport: 'cdp',
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
    browserId: 'browser-1',
    browserName: 'Test Chrome',
    extensionVersion: '0.0.1',
    extensionId: 'extension-1',
    automation: { transport: 'cdp', ready: true },
    updatedAt: new Date().toISOString(),
  };
  await writeFile(statePath, JSON.stringify(state));

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
    if (previousStatePath === undefined) {
      delete process.env[PANERELAY_STATE_PATH_ENV];
    } else {
      process.env[PANERELAY_STATE_PATH_ENV] = previousStatePath;
    }
    await rm(directory, { recursive: true, force: true });
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('returns transport-specific WebDriver Provider connection metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-provider-webdriver-'));
  const statePath = join(directory, 'bridge.json');
  const previousStatePath = process.env[PANERELAY_STATE_PATH_ENV];
  process.env[PANERELAY_STATE_PATH_ENV] = statePath;
  const server = createServer((_request, response) => {
    response.writeHead(201, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        sessionId: 'virtual-webdriver-1',
        transport: 'webdriver',
        webdriverUrl: 'http://127.0.0.1:43124/webdriver/opaque-participant',
        webdriverSessionId: 'virtual-webdriver-session',
        heartbeatIntervalMs: 10_000,
        connectExpiresAt: '2026-07-31T08:00:00.000Z',
      }),
    );
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
    browserId: 'firefox-1',
    browserName: 'Firefox',
    browserFamily: 'firefox',
    capabilities: { automation: { transport: 'webdriver', ready: true } },
    automation: { transport: 'webdriver', ready: true },
    extensionVersion: '0.2.0',
    extensionId: 'panerelay@panerelay.dev',
    updatedAt: new Date().toISOString(),
  };
  await writeFile(statePath, JSON.stringify(state));

  try {
    const response = await handlePluginRequest({
      protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
      type: 'browser.launch',
      capability: 'browser.provider',
      request: {
        session: 'firefox-session',
        clientCapabilities: [AGENT_BROWSER_WEBDRIVER_PROVIDER_CAPABILITY],
      },
    });

    assert.equal(response.success, true);
    assert.deepEqual(response.browser, {
      transport: 'webdriver',
      webdriverUrl: 'http://127.0.0.1:43124/webdriver/opaque-participant',
      webdriverSessionId: 'virtual-webdriver-session',
      metadata: {
        webdriverHeartbeatIntervalMs: 10_000,
        browserId: 'firefox-1',
        browserName: 'Firefox',
        extensionVersion: '0.2.0',
        relaySessionId: 'virtual-webdriver-1',
        connectExpiresAt: '2026-07-31T08:00:00.000Z',
      },
      cleanup: {
        bridgePid: process.pid,
        browserId: 'firefox-1',
        sessionId: 'virtual-webdriver-1',
      },
    });
  } finally {
    if (previousStatePath === undefined) {
      delete process.env[PANERELAY_STATE_PATH_ENV];
    } else {
      process.env[PANERELAY_STATE_PATH_ENV] = previousStatePath;
    }
    await rm(directory, { recursive: true, force: true });
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('rejects a CDP-only agent-browser client before requesting a Firefox relay session', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-provider-webdriver-capability-'));
  const statePath = join(directory, 'bridge.json');
  const previousStatePath = process.env[PANERELAY_STATE_PATH_ENV];
  process.env[PANERELAY_STATE_PATH_ENV] = statePath;
  const state: BridgeState = {
    protocol: PANERELAY_PROTOCOL_VERSION,
    pid: process.pid,
    port: 9,
    token: 'unused',
    browserId: 'firefox-1',
    browserName: 'Firefox',
    browserFamily: 'firefox',
    automation: { transport: 'webdriver', ready: true },
    extensionVersion: '0.2.0',
    extensionId: 'panerelay@panerelay.dev',
    updatedAt: new Date().toISOString(),
  };
  await writeFile(statePath, JSON.stringify(state));

  try {
    const response = await handlePluginRequest({
      protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
      type: 'browser.launch',
      capability: 'browser.provider',
      request: { session: 'firefox-session' },
    });

    assert.equal(response.success, false);
    assert.match(String(response.error), /webdriver-existing-session/);
  } finally {
    if (previousStatePath === undefined) {
      delete process.env[PANERELAY_STATE_PATH_ENV];
    } else {
      process.env[PANERELAY_STATE_PATH_ENV] = previousStatePath;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test('fails before contacting the Bridge when browser automation is not ready', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-provider-unsupported-'));
  const statePath = join(directory, 'bridge.json');
  const previousStatePath = process.env[PANERELAY_STATE_PATH_ENV];
  process.env[PANERELAY_STATE_PATH_ENV] = statePath;
  const state: BridgeState = {
    protocol: PANERELAY_PROTOCOL_VERSION,
    pid: process.pid,
    port: 9,
    token: 'unused',
    browserId: 'firefox-1',
    browserName: 'Firefox',
    browserFamily: 'firefox',
    capabilities: { cdpRelay: false },
    automation: { transport: 'none', ready: false },
    extensionVersion: '0.2.0',
    extensionId: 'panerelay@panerelay.dev',
    updatedAt: new Date().toISOString(),
  };
  await writeFile(statePath, JSON.stringify(state));

  try {
    const response = await handlePluginRequest({
      protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
      type: 'browser.launch',
      capability: 'browser.provider',
      request: { session: 'agent-session-1' },
    });

    assert.equal(response.success, false);
    assert.match(String(response.error), /Firefox has not made .* automation transport ready/);
  } finally {
    if (previousStatePath === undefined) {
      delete process.env[PANERELAY_STATE_PATH_ENV];
    } else {
      process.env[PANERELAY_STATE_PATH_ENV] = previousStatePath;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
