import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_PROTOCOL_VERSION,
  type AutomationActivitySnapshotMessage,
  type AutomationActivityUpdatedMessage,
  type CdpCommandMessage,
  type CdpRelaySessionCreated,
  type CdpTargetInfo,
  type ControlSessionChangedMessage,
  type HostToExtensionMessage,
  type WebDriverRelaySessionCreated,
} from '@panerelay/protocol';
import WebSocket from 'ws';
import { BrowserRelay } from './browser-relay.js';
import type { FirefoxDriverManager } from './firefox-driver.js';

function waitForOpen(client: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once('open', resolve);
    client.once('error', reject);
  });
}

function waitForMessage(client: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      client.off('message', onMessage);
      reject(error);
    };
    const onMessage = (data: WebSocket.RawData) => {
      client.off('error', onError);
      try {
        resolve(JSON.parse(data.toString()) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    };
    client.once('message', onMessage);
    client.once('error', onError);
  });
}

async function command(
  client: WebSocket,
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = waitForMessage(client);
  client.send(JSON.stringify(value));
  return result;
}

function closeClient(client: WebSocket): Promise<void> {
  if (client.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise(resolve => {
    client.once('close', resolve);
    client.close();
  });
}

function waitForClose(client: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for WebSocket close'));
    }, 2_000);
    client.once('close', (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
    client.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for test condition');
    await delay(1);
  }
}

async function createRelaySession(
  relay: BrowserRelay,
  sessionLabel = 'test-session',
): Promise<CdpRelaySessionCreated> {
  const response = await fetch(`http://127.0.0.1:${relay.port}/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${relay.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      protocol: PANERELAY_PROTOCOL_VERSION,
      actor: {
        kind: 'automation',
        name: 'agent-browser',
        sessionLabel,
      },
    }),
  });
  assert.equal(response.status, 201);
  const session = (await response.json()) as CdpRelaySessionCreated;
  assert.equal(session.transport, 'cdp');
  return session;
}

function target(
  targetId: string,
  url = `https://${targetId}.test/`,
  active = false,
): CdpTargetInfo {
  return {
    targetId,
    type: 'page',
    title: targetId,
    url,
    attached: false,
    active,
  };
}

async function register(relay: BrowserRelay): Promise<void> {
  await relay.handleExtensionMessage({
    type: 'browser.register',
    protocol: PANERELAY_PROTOCOL_VERSION,
    browserId: 'browser-1',
    browserName: 'Test Chrome',
    extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    extensionVersion: '0.0.0',
  });
}

test('rejects a browser registration from a different configured Extension ID', async () => {
  let registered = false;
  const relay = await BrowserRelay.listen({
    expectedExtensionId: 'abcdefghijklmnopabcdefghijklmnop',
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {
      registered = true;
    },
    sendToExtension: () => {},
  });
  try {
    await assert.rejects(
      relay.handleExtensionMessage({
        type: 'browser.register',
        protocol: PANERELAY_PROTOCOL_VERSION,
        browserId: 'browser-1',
        browserName: 'Test Chrome',
        extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
        extensionVersion: '0.1.0.2',
      }),
      /does not match the configured Panerelay Extension ID/,
    );
    assert.equal(registered, false);
  } finally {
    await relay.close();
  }
});

test('rejects relay allocation when the registered browser has no ready automation transport', async () => {
  const controlMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => controlMessages.push(message),
  });
  try {
    await relay.handleExtensionMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'firefox-1',
      browserName: 'Firefox',
      browserFamily: 'firefox',
      capabilities: { cdpRelay: false },
      extensionId: 'panerelay@panerelay.dev',
      extensionVersion: '0.2.0',
    });
    const response = await fetch(`http://127.0.0.1:${relay.port}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        actor: { kind: 'automation', name: 'agent-browser' },
      }),
    });

    assert.equal(response.status, 409);
    assert.match(
      (await response.json()).error,
      /Firefox has not made .* automation transport ready/,
    );
    assert.equal(
      controlMessages.some(message => message.type === 'control.session.changed'),
      false,
    );
  } finally {
    await relay.close();
  }
});

test('does not allocate a CDP participant for a ready WebDriver registration', async () => {
  const controlMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => controlMessages.push(message),
  });
  try {
    await relay.handleExtensionMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'firefox-1',
      browserName: 'Firefox',
      browserFamily: 'firefox',
      capabilities: { automation: { transport: 'webdriver', ready: true } },
      extensionId: 'panerelay@panerelay.dev',
      extensionVersion: '0.2.0',
    });
    const response = await fetch(`http://127.0.0.1:${relay.port}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        actor: { kind: 'automation', name: 'agent-browser' },
      }),
    });

    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /requires the Panerelay WebDriver relay/);
    assert.equal(
      controlMessages.some(message => message.type === 'control.session.changed'),
      false,
    );
  } finally {
    await relay.close();
  }
});

test('creates a scoped WebDriver participant and forwards only mapped exact routes', async () => {
  const driverRequests: Array<{ method: string; path: string; body?: unknown }> = [];
  let rendezvousCount = 0;
  const driver = {
    ready: true,
    sessionId: 'real-firefox-session',
    async request(method: string, path: string, body?: unknown) {
      driverRequests.push({ method, path, ...(body === undefined ? {} : { body }) });
      if (path.endsWith('/window/handles')) {
        return { status: 200, body: { value: ['window-1'] } };
      }
      if (method === 'GET' && path.endsWith('/window')) {
        return { status: 200, body: { value: 'window-1' } };
      }
      if (path.endsWith('/execute/sync')) {
        rendezvousCount += 1;
        const args = (body as { args: string[] }).args;
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'webdriver.rendezvous.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: args[0]!,
            challenge: args[1]!,
            success: true,
            targetId:
              rendezvousCount === 1
                ? 'opaque-firefox-target'
                : 'opaque-firefox-target-after-navigation',
            documentId:
              rendezvousCount === 1
                ? 'opaque-firefox-document'
                : 'opaque-firefox-document-after-navigation',
            active: true,
          });
        });
        return { status: 200, body: { value: true } };
      }
      if (method === 'GET' && path.endsWith('/url')) {
        return { status: 200, body: { value: 'https://example.test/' } };
      }
      return { status: 200, body: { value: null } };
    },
  } as unknown as FirefoxDriverManager;
  const controlMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => controlMessages.push(message),
    webdriverDriver: driver,
  });

  try {
    await relay.handleExtensionMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'firefox-1',
      browserName: 'Firefox',
      browserFamily: 'firefox',
      capabilities: { automation: { transport: 'webdriver', ready: true } },
      extensionId: 'panerelay@panerelay.dev',
      extensionVersion: '0.2.0',
    });
    await relay.handleExtensionMessage({
      type: 'webdriver.authorization.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      mode: 'single-tab',
    });
    const createdResponse = await fetch(`http://127.0.0.1:${relay.port}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        actor: { kind: 'automation', name: 'agent-browser' },
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as WebDriverRelaySessionCreated;
    assert.equal(created.transport, 'webdriver');
    assert.equal(created.heartbeatIntervalMs, 10_000);
    assert.notEqual(created.webdriverSessionId, driver.sessionId);
    assert.equal(created.webdriverUrl.includes(driver.sessionId), false);

    const heartbeatResponse = await fetch(
      `${created.webdriverUrl}/session/${created.webdriverSessionId}/panerelay/heartbeat`,
    );
    assert.equal(heartbeatResponse.status, 200);
    assert.deepEqual(await heartbeatResponse.json(), { value: null });
    assert.equal(
      driverRequests.some(request => request.path.endsWith('/panerelay/heartbeat')),
      false,
    );

    const urlResponse = await fetch(
      `${created.webdriverUrl}/session/${created.webdriverSessionId}/url`,
    );
    assert.equal(urlResponse.status, 200);
    assert.deepEqual(await urlResponse.json(), { value: 'https://example.test/' });
    assert.ok(
      driverRequests.some(
        request => request.method === 'GET' && request.path === '/session/real-firefox-session/url',
      ),
    );

    const navigateResponse = await fetch(
      `${created.webdriverUrl}/session/${created.webdriverSessionId}/url`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.test/after-navigation' }),
      },
    );
    assert.equal(navigateResponse.status, 200);

    const driverWindowEnumerationCount = driverRequests.filter(request =>
      request.path.endsWith('/window/handles'),
    ).length;
    const handlesRoute = await fetch(
      `${created.webdriverUrl}/session/${created.webdriverSessionId}/window/handles`,
    );
    assert.equal(handlesRoute.status, 200);
    assert.deepEqual(await handlesRoute.json(), {
      value: ['opaque-firefox-target-after-navigation'],
    });
    assert.equal(
      driverRequests.filter(request => request.path.endsWith('/window/handles')).length,
      driverWindowEnumerationCount,
    );

    const unauthorizedSwitch = await fetch(
      `${created.webdriverUrl}/session/${created.webdriverSessionId}/window`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: 'raw-or-unknown-window' }),
      },
    );
    assert.equal(unauthorizedSwitch.status, 403);
    assert.equal(
      driverRequests.some(
        request =>
          request.path.endsWith('/window') &&
          (request.body as { handle?: unknown } | undefined)?.handle === 'raw-or-unknown-window',
      ),
      false,
    );

    const createWithoutAllTabs = await fetch(
      `${created.webdriverUrl}/session/${created.webdriverSessionId}/window/new`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'tab' }),
      },
    );
    assert.equal(createWithoutAllTabs.status, 403);
    assert.match((await createWithoutAllTabs.json()).value.message, /all-tabs authorization/);
    assert.equal(
      driverRequests.some(request => request.path.endsWith('/window/new')),
      false,
    );

    const closeWindow = await fetch(
      `${created.webdriverUrl}/session/${created.webdriverSessionId}/window`,
      { method: 'DELETE' },
    );
    assert.equal(closeWindow.status, 200);
    assert.deepEqual(await closeWindow.json(), { value: [] });
    assert.ok(
      driverRequests.some(
        request =>
          request.method === 'DELETE' && request.path === '/session/real-firefox-session/window',
      ),
    );

    await relay.handleExtensionMessage({
      type: 'webdriver.target.invalidated',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId: 'opaque-firefox-target',
      reason: 'navigation',
    });
    const revoked = await fetch(
      `${created.webdriverUrl}/session/${created.webdriverSessionId}/title`,
    );
    assert.equal(revoked.status, 403);
    await relay.handleExtensionMessage({
      type: 'webdriver.authorization.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      mode: 'none',
    });
    const released = await fetch(
      `${created.webdriverUrl}/session/${created.webdriverSessionId}/title`,
    );
    assert.equal(released.status, 404);
    assert.ok(
      controlMessages.some(
        message => message.type === 'control.session.changed' && message.session.state === 'active',
      ),
    );
  } finally {
    await relay.close();
  }
});

test('expires an idle WebDriver participant after its scoped heartbeat stops', async () => {
  const controlMessages: HostToExtensionMessage[] = [];
  const driver = {
    ready: true,
    sessionId: 'real-firefox-session',
    async request(method: string, path: string, body?: unknown) {
      if (path.endsWith('/window/handles')) {
        return { status: 200, body: { value: ['window-1'] } };
      }
      if (method === 'GET' && path.endsWith('/window')) {
        return { status: 200, body: { value: 'window-1' } };
      }
      if (path.endsWith('/execute/sync')) {
        const args = (body as { args: string[] }).args;
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'webdriver.rendezvous.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: args[0]!,
            challenge: args[1]!,
            success: true,
            targetId: 'heartbeat-target',
            documentId: 'heartbeat-document',
          });
        });
      }
      return { status: 200, body: { value: null } };
    },
  } as unknown as FirefoxDriverManager;
  const relay = await BrowserRelay.listen({
    heartbeatIntervalMs: 10,
    heartbeatTimeoutMs: 25,
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => controlMessages.push(message),
    webdriverDriver: driver,
  });

  try {
    await relay.handleExtensionMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'firefox-heartbeat',
      browserName: 'Firefox',
      browserFamily: 'firefox',
      capabilities: { automation: { transport: 'webdriver', ready: true } },
      extensionId: 'panerelay@panerelay.dev',
      extensionVersion: '0.2.0',
    });
    await relay.handleExtensionMessage({
      type: 'webdriver.authorization.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      mode: 'single-tab',
    });
    const response = await fetch(`http://127.0.0.1:${relay.port}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        actor: { kind: 'automation', name: 'agent-browser' },
      }),
    });
    const created = (await response.json()) as WebDriverRelaySessionCreated;
    assert.equal(created.heartbeatIntervalMs, 10);
    const heartbeatUrl =
      `${created.webdriverUrl}/session/${created.webdriverSessionId}` + '/panerelay/heartbeat';
    assert.equal((await fetch(heartbeatUrl)).status, 200);

    await new Promise<void>(resolve => setTimeout(resolve, 80));

    assert.equal((await fetch(heartbeatUrl)).status, 404);
    assert.ok(
      controlMessages.some(
        message =>
          message.type === 'control.session.changed' && message.session.state === 'expired',
      ),
    );
  } finally {
    await relay.close();
  }
});

test('fails Firefox session allocation on duplicate WebDriver rendezvous responses', async () => {
  const driver = {
    ready: true,
    sessionId: 'real-firefox-session',
    async request(method: string, path: string, body?: unknown) {
      if (path.endsWith('/window/handles')) {
        return { status: 200, body: { value: ['window-1'] } };
      }
      if (method === 'GET' && path.endsWith('/window')) {
        return { status: 200, body: { value: 'window-1' } };
      }
      if (path.endsWith('/execute/sync')) {
        const args = (body as { args: string[] }).args;
        for (const targetId of ['target-1', 'target-2']) {
          queueMicrotask(() => {
            void relay.handleExtensionMessage({
              type: 'webdriver.rendezvous.result',
              protocol: PANERELAY_PROTOCOL_VERSION,
              requestId: args[0]!,
              challenge: args[1]!,
              success: true,
              targetId,
              documentId: `document-${targetId}`,
            });
          });
        }
      }
      return { status: 200, body: { value: null } };
    },
  } as unknown as FirefoxDriverManager;
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: () => {},
    webdriverDriver: driver,
  });

  try {
    await relay.handleExtensionMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'firefox-1',
      browserName: 'Firefox',
      browserFamily: 'firefox',
      capabilities: { automation: { transport: 'webdriver', ready: true } },
      extensionId: 'panerelay@panerelay.dev',
      extensionVersion: '0.2.0',
    });
    await relay.handleExtensionMessage({
      type: 'webdriver.authorization.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      mode: 'all-tabs',
    });
    const response = await fetch(`http://127.0.0.1:${relay.port}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        actor: { kind: 'automation', name: 'agent-browser' },
      }),
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /duplicate responses/);
  } finally {
    await relay.close();
  }
});

test('ignores a stale Firefox rendezvous challenge and allocates no participant', async () => {
  const driver = {
    ready: true,
    sessionId: 'real-firefox-session',
    async request(method: string, path: string, body?: unknown) {
      if (path.endsWith('/window/handles')) {
        return { status: 200, body: { value: ['window-1'] } };
      }
      if (method === 'GET' && path.endsWith('/window')) {
        return { status: 200, body: { value: 'window-1' } };
      }
      if (path.endsWith('/execute/sync')) {
        const args = (body as { args: string[] }).args;
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'webdriver.rendezvous.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: args[0]!,
            challenge: `${args[1]}-stale`,
            success: true,
            targetId: 'stale-target',
            documentId: 'stale-document',
          });
        });
      }
      return { status: 200, body: { value: null } };
    },
  } as unknown as FirefoxDriverManager;
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: () => {},
    webdriverDriver: driver,
  });

  try {
    await relay.handleExtensionMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'firefox-stale-challenge',
      browserName: 'Firefox',
      browserFamily: 'firefox',
      capabilities: { automation: { transport: 'webdriver', ready: true } },
      extensionId: 'panerelay@panerelay.dev',
      extensionVersion: '0.2.0',
    });
    await relay.handleExtensionMessage({
      type: 'webdriver.authorization.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      mode: 'single-tab',
    });
    const response = await fetch(`http://127.0.0.1:${relay.port}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        actor: { kind: 'automation', name: 'agent-browser' },
      }),
    });
    assert.equal(response.status, 409);
    assert.match(
      (await response.json()).error,
      /No uniquely authorized Firefox window completed WebDriver rendezvous/,
    );
  } finally {
    await relay.close();
  }
});

test('implements the browser-level target handshake with lazy debugger attachment', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const firstTarget = target('target-1', 'https://example.test/', true);
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      extensionMessages.push(message);
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [firstTarget, target('target-2')],
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...firstTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            result: { result: { type: 'number', value: 1 } },
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const session = await createRelaySession(relay);
  const client = new WebSocket(session.cdpUrl);
  try {
    await waitForOpen(client);
    assert.deepEqual(
      await command(client, {
        id: 1,
        method: 'Target.setDiscoverTargets',
        params: { discover: true },
      }),
      { id: 1, result: {} },
    );
    assert.deepEqual(await command(client, { id: 2, method: 'Target.getTargets' }), {
      id: 2,
      result: {
        targetInfos: [
          {
            targetId: 'target-1',
            type: 'page',
            title: 'target-1',
            url: 'https://example.test/',
            attached: false,
          },
          {
            targetId: 'target-2',
            type: 'page',
            title: 'target-2',
            url: 'https://target-2.test/',
            attached: false,
          },
        ],
      },
    });

    const attached = await command(client, {
      id: 3,
      method: 'Target.attachToTarget',
      params: { targetId: 'target-1', flatten: true },
    });
    const pageSessionId = (attached.result as { sessionId: string }).sessionId;
    assert.equal(typeof pageSessionId, 'string');
    assert.equal(
      extensionMessages.filter(message => message.type === 'cdp.attach').length,
      0,
      'Target.attachToTarget remains virtual until the first page command',
    );

    assert.deepEqual(
      await command(client, {
        id: 4,
        method: 'Runtime.evaluate',
        sessionId: pageSessionId,
        params: { expression: '1' },
      }),
      {
        id: 4,
        result: { result: { type: 'number', value: 1 } },
        sessionId: pageSessionId,
      },
    );
    const attachMessage = extensionMessages.find(message => message.type === 'cdp.attach');
    assert.equal(attachMessage?.targetId, 'target-1');
    const commandMessage = extensionMessages.find(message => message.type === 'cdp.command');
    assert.equal(commandMessage?.targetId, 'target-1');

    const event = waitForMessage(client);
    await relay.handleExtensionMessage({
      type: 'cdp.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId: 'target-1',
      method: 'Page.loadEventFired',
      params: { timestamp: 12.5 },
    });
    assert.deepEqual(await event, {
      method: 'Page.loadEventFired',
      params: { timestamp: 12.5 },
      sessionId: pageSessionId,
    });
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('keeps target relisting bounded to the Extension inventory and forwards trusted expansion', async () => {
  const initial = target('target-initial', 'https://initial.test/', true);
  const related = target('target-related', 'https://related.test/');
  let listedTargets = [initial];
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: listedTargets,
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = new WebSocket((await createRelaySession(relay)).cdpUrl);
  try {
    await waitForOpen(client);
    await command(client, {
      id: 1,
      method: 'Target.setDiscoverTargets',
      params: { discover: true },
    });
    const initialList = await command(client, { id: 2, method: 'Target.getTargets' });
    assert.deepEqual(
      (initialList.result as { targetInfos: CdpTargetInfo[] }).targetInfos.map(
        candidate => candidate.targetId,
      ),
      ['target-initial'],
    );

    const relatedCreated = waitForMessage(client);
    await relay.handleExtensionMessage({
      type: 'cdp.target.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      event: 'created',
      target: related,
    });
    assert.deepEqual(await relatedCreated, {
      method: 'Target.targetCreated',
      params: {
        targetInfo: {
          targetId: related.targetId,
          type: related.type,
          title: related.title,
          url: related.url,
          attached: false,
        },
      },
    });

    listedTargets = [initial, related];
    const boundedList = await command(client, { id: 3, method: 'Target.getTargets' });
    assert.deepEqual(
      (boundedList.result as { targetInfos: CdpTargetInfo[] }).targetInfos.map(
        candidate => candidate.targetId,
      ),
      ['target-initial', 'target-related'],
    );
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('preserves passive network observation without counting or marking page control', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const fixtureTarget = target('target-observed', 'https://observed.test/', true);
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      extensionMessages.push(message);
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [fixtureTarget],
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...fixtureTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            result: {},
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = new WebSocket((await createRelaySession(relay)).cdpUrl);
  try {
    await waitForOpen(client);
    await command(client, { id: 1, method: 'Target.getTargets' });
    const attached = await command(client, {
      id: 2,
      method: 'Target.attachToTarget',
      params: { targetId: fixtureTarget.targetId, flatten: true },
    });
    const pageSessionId = (attached.result as { sessionId: string }).sessionId;
    await command(client, {
      id: 3,
      method: 'Target.setAutoAttach',
      sessionId: pageSessionId,
      params: { autoAttach: true, waitForDebuggerOnStart: true, flatten: true },
    });
    for (const [id, method] of [
      [4, 'Page.enable'],
      [5, 'Runtime.enable'],
      [6, 'Network.enable'],
      [7, 'Runtime.runIfWaitingForDebugger'],
    ] as const) {
      await command(client, { id, method, sessionId: pageSessionId });
    }

    assert.equal(
      extensionMessages.filter(message => message.type === 'cdp.attach').length,
      1,
      'passive domain setup attaches once so events are observable immediately',
    );
    assert.deepEqual(
      extensionMessages
        .filter((message): message is CdpCommandMessage => message.type === 'cdp.command')
        .map(message => message.method),
      [
        'Target.setAutoAttach',
        'Page.enable',
        'Runtime.enable',
        'Network.enable',
        'Runtime.runIfWaitingForDebugger',
      ],
    );
    const observedStates = extensionMessages.filter(
      (message): message is ControlSessionChangedMessage =>
        message.type === 'control.session.changed' && message.session.observedTargetCount === 1,
    );
    assert.ok(observedStates.length > 0);
    assert.ok(observedStates.every(message => message.session.controlledTargetCount === 0));

    const requestEvent = waitForMessage(client);
    await relay.handleExtensionMessage({
      type: 'cdp.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId: fixtureTarget.targetId,
      method: 'Network.requestWillBeSent',
      params: { requestId: 'early-request' },
    });
    assert.deepEqual(await requestEvent, {
      method: 'Network.requestWillBeSent',
      params: { requestId: 'early-request' },
      sessionId: pageSessionId,
    });

    await command(client, {
      id: 8,
      method: 'Accessibility.getFullAXTree',
      sessionId: pageSessionId,
    });
    assert.equal(
      extensionMessages
        .filter(
          (message): message is ControlSessionChangedMessage =>
            message.type === 'control.session.changed',
        )
        .at(-1)?.session.controlledTargetCount,
      0,
    );

    await command(client, {
      id: 9,
      method: 'Runtime.evaluate',
      sessionId: pageSessionId,
      params: { expression: 'document.title' },
    });
    const controlledState = extensionMessages
      .filter(
        (message): message is ControlSessionChangedMessage =>
          message.type === 'control.session.changed',
      )
      .at(-1);
    assert.equal(controlledState?.session.observedTargetCount, 0);
    assert.equal(controlledState?.session.controlledTargetCount, 1);
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('keeps create, activate, and bring-to-front in the Agent background', async () => {
  const created = target('target-created', 'about:blank');
  const extensionMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      extensionMessages.push(message);
      if (message.type !== 'cdp.target.request') return;
      queueMicrotask(() => {
        if (message.operation.kind === 'create') {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: created,
          });
        } else if (message.operation.kind === 'close') {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
          });
        }
      });
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = new WebSocket((await createRelaySession(relay)).cdpUrl);
  try {
    await waitForOpen(client);
    assert.deepEqual(
      await command(client, {
        id: 1,
        method: 'Target.createTarget',
        params: { url: 'about:blank' },
      }),
      { id: 1, result: { targetId: 'target-created' } },
    );
    assert.deepEqual(
      extensionMessages
        .filter(message => message.type === 'cdp.target.request')
        .map(message => message.operation),
      [{ kind: 'create', url: 'about:blank', active: false }],
    );
    assert.deepEqual(
      await command(client, {
        id: 2,
        method: 'Target.activateTarget',
        params: { targetId: 'target-created' },
      }),
      { id: 2, result: {} },
    );
    assert.deepEqual(
      extensionMessages
        .filter(message => message.type === 'cdp.target.request')
        .map(message => message.operation),
      [{ kind: 'create', url: 'about:blank', active: false }],
    );

    const attach = await command(client, {
      id: 3,
      method: 'Target.attachToTarget',
      params: { targetId: 'target-created', flatten: true },
    });
    const pageSessionId = (attach.result as { sessionId: string }).sessionId;
    assert.deepEqual(
      await command(client, {
        id: 4,
        method: 'Target.setAutoAttach',
        sessionId: pageSessionId,
        params: { autoAttach: true, waitForDebuggerOnStart: true, flatten: true },
      }),
      { id: 4, result: {}, sessionId: pageSessionId },
    );
    assert.deepEqual(
      await command(client, {
        id: 5,
        method: 'Page.bringToFront',
        sessionId: pageSessionId,
      }),
      { id: 5, result: {}, sessionId: pageSessionId },
    );
    assert.equal(
      extensionMessages.some(
        message => message.type === 'cdp.attach' || message.type === 'cdp.command',
      ),
      false,
    );

    await command(client, {
      id: 6,
      method: 'Target.setDiscoverTargets',
      params: { discover: true },
    });
    const changed = waitForMessage(client);
    await relay.handleExtensionMessage({
      type: 'cdp.target.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      event: 'changed',
      target: { ...created, title: 'Ready', url: 'https://example.test/ready' },
    });
    assert.deepEqual(await changed, {
      method: 'Target.targetInfoChanged',
      params: {
        targetInfo: {
          targetId: 'target-created',
          type: 'page',
          title: 'Ready',
          url: 'https://example.test/ready',
          attached: true,
        },
      },
    });

    assert.deepEqual(
      await command(client, {
        id: 7,
        method: 'Target.closeTarget',
        params: { targetId: 'target-created' },
      }),
      { id: 7, result: { success: true } },
    );
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('routes flattened child-target sessions through the owning tab', async () => {
  const firstTarget = target('target-1', 'https://example.test/', true);
  const extensionMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      extensionMessages.push(message);
      if (message.type === 'cdp.target.request') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [firstTarget],
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...firstTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            result: {},
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = new WebSocket((await createRelaySession(relay)).cdpUrl);
  try {
    await waitForOpen(client);
    await command(client, { id: 1, method: 'Target.getTargets' });
    const attach = await command(client, {
      id: 2,
      method: 'Target.attachToTarget',
      params: { targetId: 'target-1', flatten: true },
    });
    const pageSessionId = (attach.result as { sessionId: string }).sessionId;
    await command(client, {
      id: 3,
      method: 'Target.setAutoAttach',
      sessionId: pageSessionId,
      params: { autoAttach: true, waitForDebuggerOnStart: true, flatten: true },
    });
    assert.equal(
      extensionMessages.some(
        message => message.type === 'cdp.attach' || message.type === 'cdp.command',
      ),
      false,
    );
    assert.equal(
      extensionMessages
        .filter(
          (message): message is ControlSessionChangedMessage =>
            message.type === 'control.session.changed',
        )
        .some(message => message.session.controlledTargetCount > 0),
      false,
    );

    assert.deepEqual(
      await command(client, {
        id: 4,
        method: 'Runtime.evaluate',
        sessionId: pageSessionId,
        params: { expression: 'document.title' },
      }),
      { id: 4, result: {}, sessionId: pageSessionId },
    );
    assert.deepEqual(
      extensionMessages
        .filter((message): message is CdpCommandMessage => message.type === 'cdp.command')
        .map(message => message.method),
      ['Target.setAutoAttach', 'Runtime.evaluate'],
    );
    assert.ok(
      extensionMessages
        .filter(
          (message): message is ControlSessionChangedMessage =>
            message.type === 'control.session.changed',
        )
        .some(
          message =>
            message.session.state === 'active' && message.session.controlledTargetCount === 1,
        ),
    );

    const attachedEvent = waitForMessage(client);
    await relay.handleExtensionMessage({
      type: 'cdp.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId: 'target-1',
      method: 'Target.attachedToTarget',
      params: {
        sessionId: 'chrome-child-session',
        targetInfo: {
          targetId: 'frame-1',
          type: 'iframe',
          title: '',
          url: 'https://frame.test/',
        },
        waitingForDebugger: true,
      },
    });
    assert.deepEqual(await attachedEvent, {
      method: 'Target.attachedToTarget',
      params: {
        sessionId: 'chrome-child-session',
        targetInfo: {
          targetId: 'frame-1',
          type: 'iframe',
          title: '',
          url: 'https://frame.test/',
        },
        waitingForDebugger: true,
      },
      sessionId: pageSessionId,
    });

    assert.deepEqual(
      await command(client, {
        id: 5,
        method: 'Runtime.runIfWaitingForDebugger',
        sessionId: 'chrome-child-session',
      }),
      { id: 5, result: {}, sessionId: 'chrome-child-session' },
    );
    const childCommand = extensionMessages.filter(message => message.type === 'cdp.command').at(-1);
    assert.equal(childCommand?.targetId, 'target-1');
    assert.equal(childCommand?.sessionId, 'chrome-child-session');

    const autoAttachCommand = extensionMessages.find(
      (message): message is CdpCommandMessage =>
        message.type === 'cdp.command' && message.method === 'Target.setAutoAttach',
    );
    assert.deepEqual(autoAttachCommand?.params, {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
    });
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('fails closed for top-level request pausing and browser contexts', async () => {
  const relay = await BrowserRelay.listen({
    sendToExtension: () => undefined,
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = new WebSocket((await createRelaySession(relay)).cdpUrl);
  try {
    await waitForOpen(client);
    assert.deepEqual(
      await command(client, {
        id: 1,
        method: 'Target.setAutoAttach',
        params: {
          autoAttach: true,
          waitForDebuggerOnStart: true,
          flatten: true,
        },
      }),
      {
        id: 1,
        error: {
          code: -32000,
          message: 'Panerelay cannot pause new top-level tabs before their first request',
        },
      },
    );
    assert.deepEqual(
      await command(client, {
        id: 2,
        method: 'Target.createBrowserContext',
      }),
      {
        id: 2,
        error: {
          code: -32601,
          message: 'Target.createBrowserContext is not supported by Panerelay',
        },
      },
    );
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('keeps browser-process and cookie commands inside the authorized target boundary', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const fixtureTarget = target('target-1', 'http://127.0.0.1:41732/', true);
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      extensionMessages.push(message);
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [fixtureTarget],
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...fixtureTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            result: {},
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = new WebSocket((await createRelaySession(relay)).cdpUrl);
  try {
    await waitForOpen(client);
    const attached = await command(client, {
      id: 1,
      method: 'Target.attachToTarget',
      params: { targetId: fixtureTarget.targetId, flatten: true },
    });
    const pageSessionId = (attached.result as { sessionId: string }).sessionId;

    assert.deepEqual(
      await command(client, {
        id: 2,
        method: 'Browser.grantPermissions',
        params: { permissions: ['geolocation'] },
      }),
      {
        id: 2,
        error: {
          code: -32000,
          message:
            'Browser.grantPermissions requires browser-process ownership and is not supported by Panerelay',
        },
      },
    );
    assert.deepEqual(
      await command(client, {
        id: 3,
        method: 'Browser.setDownloadBehavior',
        sessionId: pageSessionId,
        params: { behavior: 'allowAndName', downloadPath: '/tmp' },
      }),
      {
        id: 3,
        error: {
          code: -32000,
          message:
            'Browser.setDownloadBehavior requires browser-process ownership and is not supported by Panerelay',
        },
        sessionId: pageSessionId,
      },
    );
    assert.deepEqual(
      await command(client, {
        id: 4,
        method: 'Network.getAllCookies',
        sessionId: pageSessionId,
      }),
      {
        id: 4,
        error: {
          code: -32000,
          message:
            'Network.getAllCookies can access the entire daily Chrome profile and is not supported by Panerelay',
        },
        sessionId: pageSessionId,
      },
    );
    assert.deepEqual(
      await command(client, {
        id: 5,
        method: 'Network.clearBrowserCookies',
        sessionId: pageSessionId,
      }),
      {
        id: 5,
        error: {
          code: -32000,
          message:
            'Network.clearBrowserCookies can access the entire daily Chrome profile and is not supported by Panerelay',
        },
        sessionId: pageSessionId,
      },
    );
    assert.deepEqual(
      await command(client, {
        id: 6,
        method: 'Network.getCookies',
        sessionId: pageSessionId,
        params: { urls: ['https://unrelated.test/'] },
      }),
      {
        id: 6,
        error: {
          code: -32000,
          message: 'Network.getCookies is limited to the selected Panerelay target origin',
        },
        sessionId: pageSessionId,
      },
    );
    assert.deepEqual(
      await command(client, {
        id: 7,
        method: 'Network.setCookies',
        sessionId: pageSessionId,
        params: {
          cookies: [
            {
              name: 'outside',
              value: 'blocked',
              url: 'https://unrelated.test/',
            },
          ],
        },
      }),
      {
        id: 7,
        error: {
          code: -32000,
          message: 'Cookie mutation is limited to the selected Panerelay target origin',
        },
        sessionId: pageSessionId,
      },
    );
    assert.deepEqual(
      await command(client, {
        id: 8,
        method: 'Network.setCookies',
        sessionId: pageSessionId,
        params: {
          cookies: [
            {
              name: 'panerelay_acceptance',
              value: 'verified',
              url: fixtureTarget.url,
            },
          ],
        },
      }),
      { id: 8, result: {}, sessionId: pageSessionId },
    );
    assert.deepEqual(
      await command(client, {
        id: 9,
        method: 'Emulation.setTimezoneOverride',
        sessionId: pageSessionId,
        params: { timezoneId: 'UTC' },
      }),
      { id: 9, result: {}, sessionId: pageSessionId },
    );
    assert.deepEqual(
      await command(client, {
        id: 10,
        method: 'Emulation.setLocaleOverride',
        sessionId: pageSessionId,
        params: { locale: 'en-US' },
      }),
      { id: 10, result: {}, sessionId: pageSessionId },
    );
    assert.deepEqual(
      await command(client, {
        id: 11,
        method: 'Emulation.setUserAgentOverride',
        sessionId: pageSessionId,
        params: { userAgent: 'PanerelayAcceptance/0.33.0' },
      }),
      { id: 11, result: {}, sessionId: pageSessionId },
    );

    const forwardedCommands = extensionMessages.filter(
      (message): message is CdpCommandMessage => message.type === 'cdp.command',
    );
    assert.deepEqual(
      forwardedCommands.map(message => message.method),
      [
        'Network.setCookies',
        'Emulation.setTimezoneOverride',
        'Emulation.setLocaleOverride',
        'Emulation.setUserAgentOverride',
      ],
    );
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('rejects invalid credentials and keeps relay participants independently releasable', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    sendToExtension: message => extensionMessages.push(message),
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);
  let invalidClient: WebSocket | null = null;
  let staleClient: WebSocket | null = null;
  let firstClient: WebSocket | null = null;
  let secondClient: WebSocket | null = null;
  try {
    const firstSession = await createRelaySession(relay, 'first-session');
    const secondSession = await createRelaySession(relay, 'second-session');
    firstClient = new WebSocket(firstSession.cdpUrl);
    secondClient = new WebSocket(secondSession.cdpUrl);
    await Promise.all([waitForOpen(firstClient), waitForOpen(secondClient)]);
    assert.equal((await command(secondClient, { id: 1, method: 'Browser.getVersion' })).id, 1);
    assert.ok(
      extensionMessages.some(
        message =>
          message.type === 'control.session.changed' &&
          message.session.participantCount === 2 &&
          message.session.actor.sessionLabel === 'second-session',
      ),
    );

    const invalidUrl = new URL(firstSession.cdpUrl);
    invalidUrl.searchParams.set('token', 'wrong');
    invalidClient = new WebSocket(invalidUrl);
    const closed = new Promise<{ code: number; reason: string }>((resolve, reject) => {
      invalidClient?.once('close', (code, reason) => resolve({ code, reason: reason.toString() }));
      invalidClient?.once('error', reject);
    });
    assert.deepEqual(await closed, {
      code: 1008,
      reason: 'Invalid Panerelay session token',
    });

    const release = await fetch(
      `http://127.0.0.1:${relay.port}/sessions/${encodeURIComponent(secondSession.sessionId)}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${relay.token}` },
      },
    );
    assert.equal(release.status, 204);
    assert.equal((await command(firstClient, { id: 2, method: 'Browser.getVersion' })).id, 2);
    assert.ok(
      extensionMessages.some(
        message =>
          message.type === 'control.session.changed' &&
          message.session.participantCount === 1 &&
          message.session.actor.sessionLabel === 'first-session',
      ),
    );

    staleClient = new WebSocket(secondSession.cdpUrl);
    assert.deepEqual(await waitForClose(staleClient), {
      code: 1008,
      reason: 'Invalid Panerelay session token',
    });
  } finally {
    if (invalidClient) await closeClient(invalidClient);
    if (staleClient) await closeClient(staleClient);
    if (firstClient) await closeClient(firstClient);
    if (secondClient) await closeClient(secondClient);
    await relay.close();
  }
});

test('reuses target attachments and serializes commands across relay participants', async () => {
  const fixtureTarget = target('target-shared', 'https://shared.test/', true);
  const extensionMessages: HostToExtensionMessage[] = [];
  const forwardedCommands: CdpCommandMessage[] = [];
  let resolveFirstForwarded: (() => void) | undefined;
  let resolveSecondForwarded: (() => void) | undefined;
  const firstForwarded = new Promise<void>(resolve => {
    resolveFirstForwarded = resolve;
  });
  const secondForwarded = new Promise<void>(resolve => {
    resolveSecondForwarded = resolve;
  });
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      extensionMessages.push(message);
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [fixtureTarget],
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...fixtureTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        forwardedCommands.push(message);
        if (forwardedCommands.length === 1) resolveFirstForwarded?.();
        if (forwardedCommands.length === 2) resolveSecondForwarded?.();
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const firstSession = await createRelaySession(relay, 'first-participant');
  const secondSession = await createRelaySession(relay, 'second-participant');
  const firstClient = new WebSocket(firstSession.cdpUrl);
  const secondClient = new WebSocket(secondSession.cdpUrl);
  try {
    await Promise.all([waitForOpen(firstClient), waitForOpen(secondClient)]);
    await Promise.all([
      command(firstClient, { id: 1, method: 'Target.getTargets' }),
      command(secondClient, { id: 1, method: 'Target.getTargets' }),
    ]);
    const [firstAttached, secondAttached] = await Promise.all([
      command(firstClient, {
        id: 2,
        method: 'Target.attachToTarget',
        params: { targetId: fixtureTarget.targetId, flatten: true },
      }),
      command(secondClient, {
        id: 2,
        method: 'Target.attachToTarget',
        params: { targetId: fixtureTarget.targetId, flatten: true },
      }),
    ]);
    const firstPageSession = (firstAttached.result as { sessionId: string }).sessionId;
    const secondPageSession = (secondAttached.result as { sessionId: string }).sessionId;
    assert.notEqual(firstPageSession, secondPageSession);

    const firstResult = command(firstClient, {
      id: 3,
      method: 'Runtime.evaluate',
      sessionId: firstPageSession,
      params: { expression: '1' },
    });
    await firstForwarded;
    const secondResult = command(secondClient, {
      id: 3,
      method: 'Runtime.evaluate',
      sessionId: secondPageSession,
      params: { expression: '2' },
    });
    await delay(20);
    assert.equal(forwardedCommands.length, 1);

    const firstCommand = forwardedCommands[0];
    assert.ok(firstCommand);
    await relay.handleExtensionMessage({
      type: 'cdp.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: firstCommand.requestId,
      result: { value: 'first' },
    });
    assert.deepEqual(await firstResult, {
      id: 3,
      result: { value: 'first' },
      sessionId: firstPageSession,
    });

    await secondForwarded;
    const secondCommand = forwardedCommands[1];
    assert.ok(secondCommand);
    await relay.handleExtensionMessage({
      type: 'cdp.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: secondCommand.requestId,
      result: { value: 'second' },
    });
    assert.deepEqual(await secondResult, {
      id: 3,
      result: { value: 'second' },
      sessionId: secondPageSession,
    });

    assert.equal(extensionMessages.filter(message => message.type === 'cdp.attach').length, 1);
    const firstRelease = await fetch(
      `http://127.0.0.1:${relay.port}/sessions/${encodeURIComponent(firstSession.sessionId)}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${relay.token}` },
      },
    );
    assert.equal(firstRelease.status, 204);
    assert.equal(
      extensionMessages.some(
        message => message.type === 'cdp.detach' && message.targetId === fixtureTarget.targetId,
      ),
      false,
    );
    assert.equal((await command(secondClient, { id: 4, method: 'Browser.getVersion' })).id, 4);
  } finally {
    await closeClient(firstClient);
    await closeClient(secondClient);
    await relay.close();
  }
});

test('cancels queued target work when its participant disconnects without blocking others', async () => {
  const fixtureTarget = target('target-queued', 'https://queued.test/', true);
  const forwardedCommands: CdpCommandMessage[] = [];
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [fixtureTarget],
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...fixtureTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        forwardedCommands.push(message);
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const firstSession = await createRelaySession(relay, 'queue-owner');
  const secondSession = await createRelaySession(relay, 'queue-waiter');
  const firstClient = new WebSocket(firstSession.cdpUrl);
  const secondClient = new WebSocket(secondSession.cdpUrl);
  try {
    await Promise.all([waitForOpen(firstClient), waitForOpen(secondClient)]);
    await Promise.all([
      command(firstClient, { id: 1, method: 'Target.getTargets' }),
      command(secondClient, { id: 1, method: 'Target.getTargets' }),
    ]);
    const firstAttached = await command(firstClient, {
      id: 2,
      method: 'Target.attachToTarget',
      params: { targetId: fixtureTarget.targetId, flatten: true },
    });
    const secondAttached = await command(secondClient, {
      id: 2,
      method: 'Target.attachToTarget',
      params: { targetId: fixtureTarget.targetId, flatten: true },
    });
    const firstPageSession = (firstAttached.result as { sessionId: string }).sessionId;
    const secondPageSession = (secondAttached.result as { sessionId: string }).sessionId;

    const firstResult = command(firstClient, {
      id: 3,
      method: 'Runtime.evaluate',
      sessionId: firstPageSession,
      params: { expression: '1' },
    });
    await waitForCondition(() => forwardedCommands.length >= 1);
    secondClient.send(
      JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        sessionId: secondPageSession,
        params: { expression: '2' },
      }),
    );
    await delay(20);
    assert.equal(forwardedCommands.length, 1);
    const release = await fetch(
      `http://127.0.0.1:${relay.port}/sessions/${encodeURIComponent(secondSession.sessionId)}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${relay.token}` },
      },
    );
    assert.equal(release.status, 204);

    const ownerCommand = forwardedCommands[0];
    assert.ok(ownerCommand);
    await relay.handleExtensionMessage({
      type: 'cdp.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: ownerCommand.requestId,
      result: { value: 'owner' },
    });
    assert.deepEqual(await firstResult, {
      id: 3,
      result: { value: 'owner' },
      sessionId: firstPageSession,
    });

    const nextResult = command(firstClient, {
      id: 4,
      method: 'Runtime.evaluate',
      sessionId: firstPageSession,
      params: { expression: '3' },
    });
    await waitForCondition(() => forwardedCommands.length >= 2);
    const nextCommand = forwardedCommands[1];
    assert.ok(nextCommand);
    await relay.handleExtensionMessage({
      type: 'cdp.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: nextCommand.requestId,
      result: { value: 'next' },
    });
    assert.equal((await nextResult).id, 4);
  } finally {
    await closeClient(firstClient);
    await closeClient(secondClient);
    await relay.close();
  }
});

test('keeps the browser lease alive when one target detaches', async () => {
  const relay = await BrowserRelay.listen({
    sendToExtension: () => undefined,
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);
  const session = await createRelaySession(relay);
  const client = new WebSocket(session.cdpUrl);
  try {
    await waitForOpen(client);
    await relay.handleExtensionMessage({
      type: 'cdp.detached',
      protocol: PANERELAY_PROTOCOL_VERSION,
      reason: 'Target closed',
      scope: 'target',
      targetId: 'target-1',
    });
    const version = await command(client, { id: 1, method: 'Browser.getVersion' });
    assert.equal(version.id, 1);
    assert.equal(typeof (version.result as { product?: unknown }).product, 'string');
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('invalidates browser-level credentials when Extension control is revoked', async () => {
  const relay = await BrowserRelay.listen({
    sendToExtension: () => undefined,
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);
  const firstSession = await createRelaySession(relay);
  const firstClient = new WebSocket(firstSession.cdpUrl);
  let revokedClient: WebSocket | null = null;
  try {
    await waitForOpen(firstClient);
    await relay.handleExtensionMessage({
      type: 'cdp.detached',
      protocol: PANERELAY_PROTOCOL_VERSION,
      reason: 'User revoked control',
      scope: 'lease',
    });

    revokedClient = new WebSocket(firstSession.cdpUrl);
    const closed = new Promise<{ code: number; reason: string }>((resolve, reject) => {
      revokedClient?.once('close', (code, reason) => resolve({ code, reason: reason.toString() }));
      revokedClient?.once('error', reject);
    });
    assert.deepEqual(await closed, {
      code: 1008,
      reason: 'Invalid Panerelay session token',
    });
    const replacement = await createRelaySession(relay, 'replacement');
    assert.notEqual(replacement.sessionId, firstSession.sessionId);
  } finally {
    await closeClient(firstClient);
    if (revokedClient) await closeClient(revokedClient);
    await relay.close();
  }
});

test('fails a pending target command when the user revokes the relay lease', async () => {
  const fixtureTarget = target('target-1', 'http://127.0.0.1:41732/', true);
  let resolveForwardedCommand: (() => void) | undefined;
  const forwardedCommand = new Promise<void>(resolve => {
    resolveForwardedCommand = resolve;
  });
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [fixtureTarget],
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...fixtureTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        resolveForwardedCommand?.();
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = new WebSocket((await createRelaySession(relay)).cdpUrl);
  try {
    await waitForOpen(client);
    const attached = await command(client, {
      id: 1,
      method: 'Target.attachToTarget',
      params: { targetId: fixtureTarget.targetId, flatten: true },
    });
    const pageSessionId = (attached.result as { sessionId: string }).sessionId;
    const closed = new Promise<{ code: number; reason: string }>((resolve, reject) => {
      client.once('close', (code, reason) => resolve({ code, reason: reason.toString() }));
      client.once('error', reject);
    });

    client.send(
      JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        sessionId: pageSessionId,
        params: { expression: 'fetch("/api/slow?ms=5000")' },
      }),
    );
    await forwardedCommand;
    await relay.handleExtensionMessage({
      type: 'cdp.detached',
      protocol: PANERELAY_PROTOCOL_VERSION,
      reason: 'User revoked control',
      scope: 'lease',
    });

    assert.deepEqual(await closed, {
      code: 1011,
      reason: 'User revoked control',
    });
    const replacement = await createRelaySession(relay, 'replacement-after-pending');
    assert.equal(typeof replacement.sessionId, 'string');
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('detaches controlled targets when a session closes so CDP overrides are reset', async () => {
  const fixtureTarget = target('target-1', 'http://127.0.0.1:41732/', true);
  const extensionMessages: HostToExtensionMessage[] = [];
  let resolveTargetDetached: (() => void) | undefined;
  const targetDetached = new Promise<void>(resolve => {
    resolveTargetDetached = resolve;
  });
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      extensionMessages.push(message);
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [fixtureTarget],
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...fixtureTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            result: {},
          });
        });
      } else if (message.type === 'cdp.detach' && message.targetId === fixtureTarget.targetId) {
        resolveTargetDetached?.();
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = new WebSocket((await createRelaySession(relay)).cdpUrl);
  try {
    await waitForOpen(client);
    const attached = await command(client, {
      id: 1,
      method: 'Target.attachToTarget',
      params: { targetId: fixtureTarget.targetId, flatten: true },
    });
    const pageSessionId = (attached.result as { sessionId: string }).sessionId;
    await command(client, {
      id: 2,
      method: 'Fetch.enable',
      sessionId: pageSessionId,
      params: { patterns: [{ urlPattern: '**/data.json' }] },
    });
    await command(client, {
      id: 3,
      method: 'Emulation.setEmulatedMedia',
      sessionId: pageSessionId,
      params: {
        features: [{ name: 'prefers-color-scheme', value: 'dark' }],
      },
    });

    await closeClient(client);
    await targetDetached;
    assert.ok(
      extensionMessages.some(
        message =>
          message.type === 'cdp.detach' &&
          message.targetId === fixtureTarget.targetId &&
          message.reason === 'No CDP sessions remain for the target',
      ),
    );
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('keeps active lease liveness separate from the initial connection window', async () => {
  const relay = await BrowserRelay.listen({
    sendToExtension: () => undefined,
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
    sessionConnectTimeoutMs: 30,
    heartbeatIntervalMs: 10,
    heartbeatTimeoutMs: 200,
  });
  await register(relay);
  const session = await createRelaySession(relay);
  const firstClient = new WebSocket(session.cdpUrl);
  let secondClient: WebSocket | null = null;
  try {
    await waitForOpen(firstClient);
    await delay(60);
    secondClient = new WebSocket(session.cdpUrl);
    await waitForOpen(secondClient);
    assert.equal((await command(secondClient, { id: 1, method: 'Browser.getVersion' })).id, 1);
  } finally {
    await closeClient(firstClient);
    if (secondClient) await closeClient(secondClient);
    await relay.close();
  }
});

test('expires an unused allocation and rejects its stale credential', async () => {
  const relay = await BrowserRelay.listen({
    sendToExtension: () => undefined,
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
    sessionConnectTimeoutMs: 20,
  });
  await register(relay);
  const session = await createRelaySession(relay);
  let client: WebSocket | null = null;
  try {
    await delay(50);
    client = new WebSocket(session.cdpUrl);
    assert.deepEqual(await waitForClose(client), {
      code: 1008,
      reason: 'Invalid Panerelay session token',
    });
  } finally {
    if (client) await closeClient(client);
    await relay.close();
  }
});

test('keeps a session live while any authenticated transport responds to heartbeat', async () => {
  const relay = await BrowserRelay.listen({
    sendToExtension: () => undefined,
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
    heartbeatIntervalMs: 10,
    heartbeatTimeoutMs: 35,
  });
  await register(relay);
  const session = await createRelaySession(relay);
  const unresponsiveClient = new WebSocket(session.cdpUrl, { autoPong: false });
  const responsiveClient = new WebSocket(session.cdpUrl);
  try {
    await Promise.all([waitForOpen(unresponsiveClient), waitForOpen(responsiveClient)]);
    await delay(90);
    assert.equal((await command(responsiveClient, { id: 1, method: 'Browser.getVersion' })).id, 1);
  } finally {
    await closeClient(unresponsiveClient);
    await closeClient(responsiveClient);
    await relay.close();
  }
});

test('expires only an unresponsive participant while preserving a responsive participant', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    sendToExtension: message => extensionMessages.push(message),
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
    heartbeatIntervalMs: 10,
    heartbeatTimeoutMs: 35,
  });
  await register(relay);
  const staleSession = await createRelaySession(relay, 'stale-participant');
  const responsiveSession = await createRelaySession(relay, 'responsive-participant');
  const staleClient = new WebSocket(staleSession.cdpUrl, { autoPong: false });
  const responsiveClient = new WebSocket(responsiveSession.cdpUrl);
  try {
    await Promise.all([waitForOpen(staleClient), waitForOpen(responsiveClient)]);
    assert.deepEqual(await waitForClose(staleClient), {
      code: 1011,
      reason: 'Automation participant heartbeat expired',
    });
    assert.equal((await command(responsiveClient, { id: 1, method: 'Browser.getVersion' })).id, 1);
    assert.ok(
      extensionMessages.some(
        message =>
          message.type === 'control.session.changed' &&
          message.session.participantCount === 1 &&
          message.session.actor.sessionLabel === 'responsive-participant',
      ),
    );
  } finally {
    await closeClient(staleClient);
    await closeClient(responsiveClient);
    await relay.close();
  }
});

test('expires every unresponsive transport and never revives its credential', async () => {
  const relay = await BrowserRelay.listen({
    sendToExtension: () => undefined,
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
    heartbeatIntervalMs: 10,
    heartbeatTimeoutMs: 35,
  });
  await register(relay);
  const session = await createRelaySession(relay);
  const client = new WebSocket(session.cdpUrl, { autoPong: false });
  let staleClient: WebSocket | null = null;
  try {
    await waitForOpen(client);
    assert.deepEqual(await waitForClose(client), {
      code: 1011,
      reason: 'Automation lease heartbeat expired',
    });

    staleClient = new WebSocket(session.cdpUrl);
    assert.deepEqual(await waitForClose(staleClient), {
      code: 1008,
      reason: 'Invalid Panerelay session token',
    });
    const replacement = await createRelaySession(relay, 'replacement-after-heartbeat');
    assert.notEqual(replacement.sessionId, session.sessionId);
  } finally {
    await closeClient(client);
    if (staleClient) await closeClient(staleClient);
    await relay.close();
  }
});

test('emits sanitized correlated activity and visible control-session lifecycle', async () => {
  const fixtureTarget = target('target-1', 'https://private.example/account', true);
  const extensionMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      extensionMessages.push(message);
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [fixtureTarget],
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...fixtureTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            ...(message.method === 'Runtime.callFunctionOn'
              ? {
                  error: {
                    code: -32000,
                    message: 'private-result',
                  },
                }
              : {
                  result: {
                    result: { type: 'string', value: 'private-result' },
                  },
                }),
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = new WebSocket((await createRelaySession(relay, 'private-run')).cdpUrl);
  const secret = 'typed-password-and-private-selector';
  try {
    await waitForOpen(client);
    await command(client, { id: 1, method: 'Target.getTargets' });
    const attached = await command(client, {
      id: 2,
      method: 'Target.attachToTarget',
      params: { targetId: fixtureTarget.targetId, flatten: true },
    });
    const pageSessionId = (attached.result as { sessionId: string }).sessionId;
    await command(client, {
      id: 3,
      method: 'Runtime.evaluate',
      sessionId: pageSessionId,
      params: { expression: `document.querySelector("${secret}")?.textContent` },
    });
    await command(client, {
      id: 4,
      method: 'Runtime.callFunctionOn',
      sessionId: pageSessionId,
      params: { functionDeclaration: `() => "${secret}"` },
    });
    await command(client, { id: 5, method: 'Browser.close' });

    const activityMessages = extensionMessages.filter(
      (message): message is AutomationActivityUpdatedMessage =>
        message.type === 'control.activity.updated',
    );
    const runtimeActivity = activityMessages.filter(
      message =>
        message.activity.targetId === fixtureTarget.targetId &&
        message.activity.category === 'page-content',
    );
    assert.equal(runtimeActivity.length, 4);
    assert.equal(runtimeActivity[0]?.activity.status, 'started');
    assert.equal(runtimeActivity[1]?.activity.status, 'completed');
    assert.equal(runtimeActivity[0]?.activity.id, runtimeActivity[1]?.activity.id);
    assert.equal(runtimeActivity[2]?.activity.status, 'started');
    assert.equal(runtimeActivity[3]?.activity.status, 'failed');
    assert.equal(runtimeActivity[3]?.activity.failure, 'browser-error');
    assert.equal(runtimeActivity[2]?.activity.id, runtimeActivity[3]?.activity.id);

    const deniedActivity = activityMessages.slice(-2);
    assert.equal(deniedActivity[0]?.activity.status, 'started');
    assert.equal(deniedActivity[1]?.activity.status, 'denied');
    assert.equal(deniedActivity[1]?.activity.failure, 'policy-denied');
    assert.equal(deniedActivity[0]?.activity.id, deniedActivity[1]?.activity.id);

    const serializedActivity = JSON.stringify(activityMessages);
    assert.equal(serializedActivity.includes(secret), false);
    assert.equal(serializedActivity.includes(fixtureTarget.url), false);
    assert.equal(serializedActivity.includes('Runtime.evaluate'), false);
    assert.equal(serializedActivity.includes('private-result'), false);

    const sessionMessages = extensionMessages.filter(
      (message): message is ControlSessionChangedMessage =>
        message.type === 'control.session.changed',
    );
    assert.ok(sessionMessages.some(message => message.session.state === 'allocated'));
    assert.ok(sessionMessages.some(message => message.session.state === 'connected'));
    assert.ok(
      sessionMessages.some(
        message =>
          message.session.state === 'active' && message.session.controlledTargetCount === 1,
      ),
    );

    await relay.handleExtensionMessage({
      type: 'cdp.detached',
      protocol: PANERELAY_PROTOCOL_VERSION,
      reason: 'User revoked control',
      scope: 'lease',
    });
    const terminal = extensionMessages
      .filter(
        (message): message is ControlSessionChangedMessage =>
          message.type === 'control.session.changed',
      )
      .at(-1);
    assert.equal(terminal?.session.state, 'released');
    assert.equal(terminal?.session.controlledTargetCount, 0);
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('bounds activity history and replays a sequenced snapshot on registration', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    sendToExtension: message => extensionMessages.push(message),
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);
  const client = new WebSocket((await createRelaySession(relay, 'bounded-history')).cdpUrl);
  try {
    await waitForOpen(client);
    for (let id = 1; id <= 105; id += 1) {
      await command(client, { id, method: 'Browser.getVersion' });
    }

    await register(relay);
    const snapshot = extensionMessages
      .filter(
        (message): message is AutomationActivitySnapshotMessage =>
          message.type === 'control.activity.snapshot',
      )
      .at(-1);
    assert.equal(snapshot?.activities.length, 100);
    assert.ok((snapshot?.firstRetainedSequence ?? 0) > 0);
    assert.equal(snapshot?.sequence, snapshot?.activities.at(-1)?.sequence);
    assert.ok(snapshot?.activities.every(activity => activity.status === 'completed'));
    assert.ok(
      snapshot?.activities.every(
        activity => !('method' in activity) && !('params' in activity) && !('result' in activity),
      ),
    );
  } finally {
    await closeClient(client);
    await relay.close();
  }
});
