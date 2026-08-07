import assert from 'node:assert/strict';
import test from 'node:test';
import { request as httpRequest } from 'node:http';
import {
  PANERELAY_FETCH_SESSION_PROTOCOL,
  PANERELAY_FETCH_PERMISSION_PROTOCOL,
  PANERELAY_PROTOCOL_VERSION,
  type AutomationActivitySnapshotMessage,
  type AutomationActivityUpdatedMessage,
  type CdpCommandMessage,
  type CdpControlUpdatedMessage,
  type CdpTargetInfo,
  type ControlSessionChangedMessage,
  type HostToExtensionMessage,
  type RelaySessionCreated,
  type CdpBootstrapCreated,
  type BrowserFetchRequestMessage,
  type BrowserFetchPermissionRequestMessage,
  type BrowserFetchSessionCreated,
} from '@panerelay/protocol';
import WebSocket from 'ws';
import { BrowserRelay } from './browser-relay.js';
import { HostReleaseCoordinator } from './host-release-coordinator.js';
import { NativeHostUpdateFailure } from './host-updater.js';

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
  initialTargetId?: string,
): Promise<RelaySessionCreated> {
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
      ...(initialTargetId ? { initialTargetId } : {}),
    }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as RelaySessionCreated;
}

async function createBrowserUseClient(
  relay: BrowserRelay,
  actorName = 'Browser Use',
): Promise<WebSocket> {
  const response = await fetch(`http://127.0.0.1:${relay.port}/cdp/bootstrap`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${relay.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      protocol: PANERELAY_PROTOCOL_VERSION,
      browser: { browserId: 'browser-1', generation: relay.generation },
      actor: { kind: 'automation', name: actorName },
      engine: 'browser-use',
      laneKey: 'browser-use:test',
      connectionPolicy: 'single',
    }),
  });
  assert.equal(response.status, 201);
  const ticket = (await response.json()) as CdpBootstrapCreated;
  const version = await fetch(`${ticket.cdpUrl}/json/version`);
  assert.equal(version.status, 200);
  const metadata = (await version.json()) as { webSocketDebuggerUrl: string };
  const client = new WebSocket(metadata.webSocketDebuggerUrl);
  await waitForOpen(client);
  return client;
}

async function createPlaywrightClient(
  relay: BrowserRelay,
  initialTargetId?: string,
): Promise<WebSocket> {
  const response = await fetch(`http://127.0.0.1:${relay.port}/cdp/bootstrap`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${relay.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      protocol: PANERELAY_PROTOCOL_VERSION,
      browser: { browserId: 'browser-1', generation: relay.generation },
      actor: { kind: 'automation', name: 'Playwright CLI' },
      engine: 'playwright',
      laneKey: 'playwright:test',
      connectionPolicy: 'single',
      ...(initialTargetId ? { initialTargetId } : {}),
    }),
  });
  assert.equal(response.status, 201);
  const ticket = (await response.json()) as CdpBootstrapCreated;
  const version = await fetch(`${ticket.cdpUrl}/json/version`);
  assert.equal(version.status, 200);
  const metadata = (await version.json()) as { webSocketDebuggerUrl: string };
  const client = new WebSocket(metadata.webSocketDebuggerUrl);
  await waitForOpen(client);
  return client;
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

async function register(
  relay: BrowserRelay,
  releaseVersion = '0.0.0',
  checkHostUpdate = false,
): Promise<void> {
  await relay.handleExtensionMessage({
    type: 'browser.register',
    protocol: PANERELAY_PROTOCOL_VERSION,
    browserId: 'browser-1',
    browserName: 'Test Chrome',
    extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    releaseVersion,
    buildVersion: '0.0.0.0',
    checkHostUpdate,
    capabilities: { cdpRelay: true, browserFetch: true },
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
        releaseVersion: '0.1.0',
        buildVersion: '0.1.0.2',
        checkHostUpdate: true,
      }),
      /does not match the configured Panerelay Extension ID/,
    );
    assert.equal(registered, false);
  } finally {
    await relay.close();
  }
});

test('completes browser registration before starting background release maintenance', async () => {
  let registered = false;
  let maintenanceStarted = false;
  const sent: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    expectedExtensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {
      registered = true;
    },
    afterBrowserRegistration: () => {
      assert.equal(
        sent.some(message => message.type === 'browser.registered'),
        true,
      );
      maintenanceStarted = true;
    },
    sendToExtension: message => sent.push(message),
  });
  try {
    await register(relay);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(registered, true);
    assert.equal(maintenanceStarted, true);
    assert.equal(
      sent.some(message => message.type === 'browser.registered'),
      true,
    );
  } finally {
    await relay.close();
  }
});

test('keeps an older generation registered while updating, then registers its replacement', async () => {
  const oldMessages: HostToExtensionMessage[] = [];
  let restartRequested = false;
  let oldRegistered = false;
  const oldCoordinator = new HostReleaseCoordinator({
    hostVersion: '0.7.0',
    requestRestart: () => {
      restartRequested = true;
    },
    runUpdate: async () => {},
    sendToExtension: message => oldMessages.push(message),
  });
  const oldRelay = await BrowserRelay.listen({
    expectedExtensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    hostVersion: '0.7.0',
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {
      oldRegistered = true;
    },
    afterBrowserRegistration: browser => oldCoordinator.evaluateRegistration(browser),
    sendToExtension: message => oldMessages.push(message),
  });
  await register(oldRelay, '0.8.0', true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(oldRegistered, true);
  assert.equal(restartRequested, true);
  assert.deepEqual(
    oldMessages.map(message =>
      message.type === 'host.update.status' ? message.state : message.type,
    ),
    ['browser.registered', 'control.activity.snapshot', 'restart-pending'],
  );
  await oldRelay.close();

  const replacementMessages: HostToExtensionMessage[] = [];
  let replacementRegistered = false;
  const replacementCoordinator = new HostReleaseCoordinator({
    hostVersion: '0.8.0',
    requestRestart: () => {},
    runUpdate: async () => {
      throw new Error('A matching replacement must not update again');
    },
    sendToExtension: message => replacementMessages.push(message),
  });
  const replacementRelay = await BrowserRelay.listen({
    expectedExtensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    hostVersion: '0.8.0',
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {
      replacementRegistered = true;
    },
    afterBrowserRegistration: browser => replacementCoordinator.evaluateRegistration(browser),
    sendToExtension: message => replacementMessages.push(message),
  });
  try {
    await register(replacementRelay, '0.8.0');
    assert.equal(replacementRegistered, true);
    assert.deepEqual(replacementMessages[0], {
      type: 'browser.registered',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'browser-1',
      hostVersion: '0.8.0',
    });
    assert.equal(replacementMessages[1]?.type, 'control.activity.snapshot');
  } finally {
    await replacementRelay.close();
  }
});

test('keeps relay sessions available after a background Host update fails', async () => {
  const messages: HostToExtensionMessage[] = [];
  const coordinator = new HostReleaseCoordinator({
    hostVersion: '0.7.0',
    requestRestart: () => {
      throw new Error('A failed Host update must not request restart');
    },
    runUpdate: async () => {
      throw new NativeHostUpdateFailure('network', 'private npm output');
    },
    sendToExtension: message => messages.push(message),
  });
  const relay = await BrowserRelay.listen({
    afterBrowserRegistration: browser => coordinator.evaluateRegistration(browser),
    hostVersion: '0.7.0',
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => messages.push(message),
  });
  try {
    await register(relay, '0.8.0', true);
    await waitForCondition(() => coordinator.state === 'failed');

    const session = await createRelaySession(relay, 'failed-update-still-connected');
    assert.equal(typeof session.sessionId, 'string');
    assert.equal(
      messages.some(message => message.type === 'host.update.status' && message.state === 'failed'),
      true,
    );
  } finally {
    await relay.close();
  }
});

test('preserves Edge registration metadata', async () => {
  let registered:
    | {
        browserFamily?: string;
        capabilities?: { cdpRelay: boolean };
      }
    | undefined;
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: browser => {
      registered = browser;
    },
    sendToExtension: () => {},
  });
  try {
    await relay.handleExtensionMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'edge-1',
      browserName: 'Microsoft Edge',
      browserFamily: 'edge',
      capabilities: { cdpRelay: true },
      extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
      releaseVersion: '0.2.0',
      buildVersion: '0.2.0.0',
      checkHostUpdate: false,
    });
    assert.deepEqual(registered?.browserFamily, 'edge');
    assert.deepEqual(registered?.capabilities, { cdpRelay: true });
  } finally {
    await relay.close();
  }
});

test('rejects relay allocation when the registered browser lacks CDP support', async () => {
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
      browserId: 'unsupported-1',
      browserName: 'Unsupported browser',
      browserFamily: 'unknown',
      capabilities: { cdpRelay: false },
      extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
      releaseVersion: '0.2.0',
      buildVersion: '0.2.0.0',
      checkHostUpdate: false,
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
      String(((await response.json()) as { error?: string }).error),
      /cannot provide a CDP relay/,
    );
    assert.equal(
      controlMessages.some(message => message.type === 'control.session.changed'),
      false,
    );
  } finally {
    await relay.close();
  }
});

test('creates generation-bound fetch-only sessions and correlates Extension results', async () => {
  const messages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => {
      messages.push(message);
      if (message.type !== 'fetch.request') return;
      void relay.handleExtensionMessage({
        type: 'fetch.result',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        success: true,
        response: {
          status: 404,
          statusText: 'Not Found',
          headers: { 'content-type': 'application/json' },
          body: { missing: true },
          bodyType: 'json',
          url: message.request.url,
          redirected: false,
          attachedCookieCount: 2,
        },
      });
    },
  });
  const createSession = (generation: string) =>
    fetch(`http://127.0.0.1:${relay.port}/fetch/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        browser: { browserId: 'browser-1', generation },
      }),
    });
  try {
    await register(relay);
    const stale = await createSession('stale-generation');
    assert.equal(stale.status, 409);

    const created = await createSession(relay.generation);
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('cache-control'), 'no-store');
    const session = (await created.json()) as BrowserFetchSessionCreated;
    assert.equal(session.protocol, PANERELAY_FETCH_SESSION_PROTOCOL);
    assert.equal(Number.isFinite(Date.parse(session.expiresAt)), true);
    assert.doesNotMatch(JSON.stringify(messages), new RegExp(session.token));

    const unauthorized = await fetch(session.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://api.example.com/missing' }),
    });
    assert.equal(unauthorized.status, 401);

    const fetched = await fetch(session.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://api.example.com/missing',
        headers: { Origin: 'https://example.com', Referer: '' },
      }),
    });
    assert.equal(fetched.status, 200);
    assert.deepEqual(await fetched.json(), {
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'application/json' },
      body: { missing: true },
      bodyType: 'json',
      url: 'https://api.example.com/missing',
      redirected: false,
      attachedCookieCount: 2,
    });
    const requestMessage = messages.find(
      (message): message is BrowserFetchRequestMessage => message.type === 'fetch.request',
    );
    assert.deepEqual(requestMessage?.request.headers, {
      Origin: 'https://example.com',
      Referer: '',
    });
    assert.equal(
      messages.some(message => message.type === 'control.session.changed'),
      false,
    );

    const released = await fetch(
      `http://127.0.0.1:${relay.port}/fetch/sessions/${session.sessionId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${relay.token}` },
      },
    );
    assert.equal(released.status, 204);
    const afterRelease = await fetch(session.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: 'https://api.example.com/missing' }),
    });
    assert.equal(afterRelease.status, 401);
  } finally {
    await relay.close();
  }
});

test('rejects fetch sessions when Extension fetch support is unavailable', async () => {
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: () => {},
  });
  try {
    await relay.handleExtensionMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'browser-1',
      browserName: 'Old Chrome',
      extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
      releaseVersion: '0.8.0',
      buildVersion: '0.8.0.0',
      checkHostUpdate: false,
      capabilities: { cdpRelay: true },
    });
    const response = await fetch(`http://127.0.0.1:${relay.port}/fetch/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        browser: { browserId: 'browser-1', generation: relay.generation },
      }),
    });
    assert.equal(response.status, 409);
    assert.match(String(((await response.json()) as { error: string }).error), /does not support/);
  } finally {
    await relay.close();
  }
});

test('authenticates and correlates generation-bound Agent fetch domain approval', async () => {
  const messages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => {
      messages.push(message);
      if (message.type !== 'fetch.permission.request') return;
      void relay.handleExtensionMessage({
        type: 'fetch.permission.result',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId: message.requestId,
        granted: true,
        domain: message.domain,
        scope: 'domain',
      });
    },
  });
  const request = (authorization: string | undefined, generation: string = relay.generation) =>
    fetch(`http://127.0.0.1:${relay.port}/fetch/permissions`, {
      method: 'POST',
      headers: {
        ...(authorization ? { authorization } : {}),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
        browser: { browserId: 'browser-1', generation },
        domain: '*.baidu.com',
      }),
    });
  try {
    await register(relay);
    assert.equal((await request(undefined)).status, 401);
    assert.equal((await request(`Bearer ${relay.token}`, 'stale')).status, 409);
    const response = await request(`Bearer ${relay.token}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
      granted: true,
      domain: '*.baidu.com',
      scope: 'domain',
    });
    const nativeRequest = messages.find(
      (message): message is BrowserFetchPermissionRequestMessage =>
        message.type === 'fetch.permission.request',
    );
    assert.equal(nativeRequest?.domain, '*.baidu.com');
    assert.equal(
      messages.some(message => message.type === 'control.session.changed'),
      false,
    );
  } finally {
    await relay.close();
  }
});

test('issues authenticated bounded CDP bootstrap tickets without allocating a participant', async () => {
  const controlMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    bootstrapMaxOutstandingTickets: 1,
    bootstrapTicketTtlMs: 1_000,
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => controlMessages.push(message),
  });
  const endpoint = `http://127.0.0.1:${relay.port}/cdp/bootstrap`;
  const headers = {
    authorization: `Bearer ${relay.token}`,
    'content-type': 'application/json',
  };
  const payload = () => ({
    protocol: PANERELAY_PROTOCOL_VERSION,
    browser: { browserId: 'browser-1', generation: relay.generation },
    actor: { kind: 'automation', name: 'Browser Use' },
    engine: 'browser-use',
    laneKey: 'browser-use:default',
    connectionPolicy: 'single',
  });
  try {
    const unavailable = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload()),
    });
    assert.equal(unavailable.status, 503);

    await register(relay);
    const unauthorized = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload()),
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(
      ((await unauthorized.json()) as { error: { code: string } }).error.code,
      'unauthorized',
    );

    const malformed = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload(), connectionPolicy: 'multiple' }),
    });
    assert.equal(malformed.status, 400);

    const changed = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload(),
        browser: { browserId: 'browser-1', generation: 'stale-generation' },
      }),
    });
    assert.equal(changed.status, 409);
    assert.equal(
      ((await changed.json()) as { error: { code: string } }).error.code,
      'generation-changed',
    );

    const issued = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload()),
    });
    assert.equal(issued.status, 201);
    assert.equal(issued.headers.get('cache-control'), 'no-store');
    assert.equal(issued.headers.get('access-control-allow-origin'), null);
    const ticket = (await issued.json()) as CdpBootstrapCreated;
    assert.match(
      ticket.cdpUrl,
      new RegExp(`^http://127\\.0\\.0\\.1:${relay.port}/cdp/bootstrap/[A-Za-z0-9_-]{43}$`),
    );
    assert.equal(Number.isFinite(Date.parse(ticket.expiresAt)), true);
    assert.equal(
      controlMessages.some(message => message.type === 'control.session.changed'),
      false,
    );

    const overLimit = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload(), laneKey: 'browser-use:second' }),
    });
    assert.equal(overLimit.status, 429);
    assert.equal(
      ((await overLimit.json()) as { error: { code: string } }).error.code,
      'ticket-limit',
    );
  } finally {
    await relay.close();
  }
});

test('resolves ticket-specific DevTools version metadata lazily and idempotently', async () => {
  const controlMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    bootstrapConnectionWindowMs: 1_000,
    bootstrapTicketTtlMs: 300,
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => controlMessages.push(message),
  });
  const issue = async (laneKey: string): Promise<CdpBootstrapCreated> => {
    const response = await fetch(`http://127.0.0.1:${relay.port}/cdp/bootstrap`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        browser: { browserId: 'browser-1', generation: relay.generation },
        actor: { kind: 'automation', name: 'Browser Use' },
        engine: 'browser-use',
        laneKey,
        connectionPolicy: 'single',
      }),
    });
    assert.equal(response.status, 201);
    return (await response.json()) as CdpBootstrapCreated;
  };
  try {
    await register(relay);
    const first = await issue('browser-use:default');
    const beforeVersion = controlMessages.filter(
      message => message.type === 'control.session.changed',
    ).length;
    const version = await fetch(`${first.cdpUrl}/json/version`);
    assert.equal(version.status, 200);
    assert.equal(version.headers.get('cache-control'), 'no-store');
    assert.equal(version.headers.get('access-control-allow-origin'), null);
    const metadata = (await version.json()) as Record<string, unknown>;
    assert.equal(metadata['Protocol-Version'], '1.3');
    assert.equal(metadata.Browser, 'Panerelay/0.0.0');
    assert.match(String(metadata.webSocketDebuggerUrl), /^ws:\/\/127\.0\.0\.1:/);
    const afterFirstVersion = controlMessages.filter(
      message => message.type === 'control.session.changed',
    ).length;
    assert.equal(afterFirstVersion, beforeVersion + 1);

    const repeated = await fetch(`${first.cdpUrl}/json/version`);
    assert.equal(repeated.status, 200);
    assert.deepEqual(await repeated.json(), metadata);
    assert.equal(
      controlMessages.filter(message => message.type === 'control.session.changed').length,
      afterFirstVersion,
    );

    const competing = await issue('browser-use:default');
    const busy = await fetch(`${competing.cdpUrl}/json/version`);
    assert.equal(busy.status, 409);
    assert.equal(((await busy.json()) as { error: { code: string } }).error.code, 'lane-busy');

    const expired = await issue('browser-use:expired');
    await delay(350);
    const expiredResponse = await fetch(`${expired.cdpUrl}/json/version`);
    assert.equal(expiredResponse.status, 410);
    assert.equal(
      ((await expiredResponse.json()) as { error: { code: string } }).error.code,
      'ticket-expired',
    );

    const invalid = await fetch(
      `http://127.0.0.1:${relay.port}/cdp/bootstrap/${'x'.repeat(43)}/json/version`,
    );
    assert.equal(invalid.status, 404);
    assert.equal(
      ((await invalid.json()) as { error: { code: string } }).error.code,
      'ticket-invalid',
    );
  } finally {
    await relay.close();
  }
});

test('isolates Playwright discovery from Browser Use and accepts standard trailing-slash discovery', async () => {
  const controlMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => {
      controlMessages.push(message);
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [],
          });
        });
      }
    },
  });
  const issue = async (
    engine: 'browser-use' | 'playwright',
    laneKey: string,
  ): Promise<CdpBootstrapCreated> => {
    const response = await fetch(`http://127.0.0.1:${relay.port}/cdp/bootstrap`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        browser: { browserId: 'browser-1', generation: relay.generation },
        actor: {
          kind: 'automation',
          name: engine === 'playwright' ? 'Playwright CLI' : 'Browser Use',
        },
        engine,
        laneKey,
        connectionPolicy: 'single',
      }),
    });
    assert.equal(response.status, 201);
    return (await response.json()) as CdpBootstrapCreated;
  };
  const clients: WebSocket[] = [];
  try {
    await register(relay);
    const browserUseTicket = await issue('browser-use', 'browser-use:panerelay');
    const browserUseVersion = await fetch(`${browserUseTicket.cdpUrl}/json/version`);
    assert.equal(browserUseVersion.status, 200);
    const browserUseMetadata = (await browserUseVersion.json()) as Record<string, unknown>;

    const playwrightTicket = await issue('playwright', 'playwright:panerelay');
    const playwrightVersion = await fetch(`${playwrightTicket.cdpUrl}/json/version/`);
    assert.equal(playwrightVersion.status, 200);
    assert.equal(playwrightVersion.headers.get('cache-control'), 'no-store');
    const playwrightMetadata = (await playwrightVersion.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(playwrightMetadata).sort(), [
      'Browser',
      'Protocol-Version',
      'User-Agent',
      'V8-Version',
      'WebKit-Version',
      'webSocketDebuggerUrl',
    ]);
    const repeated = await fetch(`${playwrightTicket.cdpUrl}/json/version`);
    assert.equal(repeated.status, 200);
    assert.deepEqual(await repeated.json(), playwrightMetadata);

    const browserUseClient = new WebSocket(String(browserUseMetadata.webSocketDebuggerUrl));
    const playwrightClient = new WebSocket(String(playwrightMetadata.webSocketDebuggerUrl));
    clients.push(browserUseClient, playwrightClient);
    await Promise.all([waitForOpen(browserUseClient), waitForOpen(playwrightClient)]);
    assert.equal((await command(browserUseClient, { id: 1, method: 'Browser.getVersion' })).id, 1);
    assert.equal((await command(playwrightClient, { id: 1, method: 'Browser.getVersion' })).id, 1);
    assert.ok(
      controlMessages.some(
        message =>
          message.type === 'control.session.changed' && message.session.participantCount === 2,
      ),
    );

    const competingPlaywright = await issue('playwright', 'playwright:panerelay');
    const busy = await fetch(`${competingPlaywright.cdpUrl}/json/version/`);
    assert.equal(busy.status, 409);
    assert.equal(((await busy.json()) as { error: { code: string } }).error.code, 'lane-busy');
    assert.equal((await command(browserUseClient, { id: 2, method: 'Browser.getVersion' })).id, 2);
  } finally {
    await Promise.all(clients.map(closeClient));
    await relay.close();
  }
});

test('consumes a bootstrap WebSocket credential once while keeping the connection usable', async () => {
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: () => {},
  });
  let firstClient: WebSocket | null = null;
  let secondClient: WebSocket | null = null;
  try {
    await register(relay);
    const issued = await fetch(`http://127.0.0.1:${relay.port}/cdp/bootstrap`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        browser: { browserId: 'browser-1', generation: relay.generation },
        actor: { kind: 'automation', name: 'Browser Use' },
        engine: 'browser-use',
        laneKey: 'browser-use:default',
        connectionPolicy: 'single',
      }),
    });
    const ticket = (await issued.json()) as CdpBootstrapCreated;
    const version = await fetch(`${ticket.cdpUrl}/json/version`);
    const metadata = (await version.json()) as { webSocketDebuggerUrl: string };

    firstClient = new WebSocket(metadata.webSocketDebuggerUrl);
    await waitForOpen(firstClient);
    assert.equal((await command(firstClient, { id: 1, method: 'Browser.getVersion' })).id, 1);

    const consumedVersion = await fetch(`${ticket.cdpUrl}/json/version`);
    assert.equal(consumedVersion.status, 410);
    assert.equal(
      ((await consumedVersion.json()) as { error: { code: string } }).error.code,
      'ticket-consumed',
    );

    secondClient = new WebSocket(metadata.webSocketDebuggerUrl);
    assert.deepEqual(await waitForClose(secondClient), {
      code: 1008,
      reason: 'Invalid Panerelay session token',
    });
    assert.equal((await command(firstClient, { id: 2, method: 'Browser.getVersion' })).id, 2);
  } finally {
    if (firstClient) await closeClient(firstClient);
    if (secondClient) await closeClient(secondClient);
    await relay.close();
  }
});

test('invalidates Playwright tickets and lanes on transport loss and Extension revocation', async () => {
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: () => {},
  });
  const issue = async (laneKey: string): Promise<CdpBootstrapCreated> => {
    const response = await fetch(`http://127.0.0.1:${relay.port}/cdp/bootstrap`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        browser: { browserId: 'browser-1', generation: relay.generation },
        actor: { kind: 'automation', name: 'Playwright CLI' },
        engine: 'playwright',
        laneKey,
        connectionPolicy: 'single',
      }),
    });
    assert.equal(response.status, 201);
    return (await response.json()) as CdpBootstrapCreated;
  };
  const connect = async (ticket: CdpBootstrapCreated): Promise<WebSocket> => {
    const version = await fetch(`${ticket.cdpUrl}/json/version`);
    assert.equal(version.status, 200);
    const client = new WebSocket(
      String(((await version.json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl),
    );
    await waitForOpen(client);
    return client;
  };
  let client: WebSocket | null = null;
  try {
    await register(relay);
    const first = await issue('playwright:panerelay');
    client = await connect(first);
    await closeClient(client);
    client = null;

    const replacement = await issue('playwright:panerelay');
    client = await connect(replacement);
    const revoked = waitForClose(client);
    await relay.handleExtensionMessage({
      type: 'cdp.detached',
      protocol: PANERELAY_PROTOCOL_VERSION,
      scope: 'lease',
      reason: 'User revoked control',
    });
    assert.deepEqual(await revoked, { code: 1011, reason: 'User revoked control' });
    client = null;
    const oldVersion = await fetch(`${replacement.cdpUrl}/json/version`);
    assert.equal(oldVersion.status, 404);
    assert.equal(
      ((await oldVersion.json()) as { error: { code: string } }).error.code,
      'ticket-invalid',
    );

    const unused = await issue('playwright:unused');
    await relay.handleExtensionMessage({
      type: 'cdp.detached',
      protocol: PANERELAY_PROTOCOL_VERSION,
      scope: 'lease',
      reason: 'Site authorization was revoked',
    });
    const unusedVersion = await fetch(`${unused.cdpUrl}/json/version`);
    assert.equal(unusedVersion.status, 404);
  } finally {
    if (client) await closeClient(client);
    await relay.close();
  }
});

test('bounds bootstrap HTTP methods, bodies, time, participants, and diagnostics', async () => {
  const relay = await BrowserRelay.listen({
    httpRequestTimeoutMs: 20,
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: () => {},
  });
  const endpoint = `http://127.0.0.1:${relay.port}/cdp/bootstrap`;
  const headers = {
    authorization: `Bearer ${relay.token}`,
    'content-type': 'application/json',
  };
  const bodyMarker = 'page-content-must-not-print';
  try {
    await register(relay);
    const preflight = await fetch(endpoint, {
      method: 'OPTIONS',
      headers: { ...headers, origin: 'https://attacker.test' },
    });
    assert.equal(preflight.status, 404);
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);

    const unknown = await fetch(`${endpoint}/unknown/json/list`, { headers });
    assert.equal(unknown.status, 404);

    const oversized = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ value: `${bodyMarker}${'x'.repeat(17 * 1024)}` }),
    });
    assert.equal(oversized.status, 413);
    const oversizedText = await oversized.text();
    assert.doesNotMatch(oversizedText, new RegExp(bodyMarker));
    assert.doesNotMatch(oversizedText, new RegExp(relay.token));

    const timedOut = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const request = httpRequest(
        endpoint,
        {
          method: 'POST',
          headers: { ...headers, 'content-length': '100' },
        },
        response => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', chunk => {
            body += chunk;
          });
          response.on('end', () => {
            request.destroy();
            resolve({ status: response.statusCode ?? 0, body });
          });
        },
      );
      request.once('error', reject);
      request.write('{');
    });
    assert.equal(timedOut.status, 408);
    assert.doesNotMatch(timedOut.body, new RegExp(relay.token));

    for (let index = 0; index < 8; index += 1) {
      await createRelaySession(relay, `participant-${index}`);
    }
    const ticketResponse = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        browser: { browserId: 'browser-1', generation: relay.generation },
        actor: { kind: 'automation', name: 'Browser Use' },
        engine: 'browser-use',
        laneKey: 'browser-use:limited',
        connectionPolicy: 'single',
      }),
    });
    assert.equal(ticketResponse.status, 201);
    const limitedTicket = (await ticketResponse.json()) as CdpBootstrapCreated;
    const participantLimit = await fetch(`${limitedTicket.cdpUrl}/json/version`);
    assert.equal(participantLimit.status, 429);
    const participantLimitText = await participantLimit.text();
    assert.equal(
      (JSON.parse(participantLimitText) as { error: { code: string } }).error.code,
      'participant-limit',
    );
    assert.doesNotMatch(participantLimitText, /[A-Za-z0-9_-]{43}/);
    assert.doesNotMatch(participantLimitText, new RegExp(relay.token));
  } finally {
    await relay.close();
  }
});

test('allows exactly one usable client in a simultaneous bootstrap handshake race', async () => {
  const relay = await BrowserRelay.listen({
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: () => {},
  });
  const clients: WebSocket[] = [];
  try {
    await register(relay);
    const issued = await fetch(`http://127.0.0.1:${relay.port}/cdp/bootstrap`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        browser: { browserId: 'browser-1', generation: relay.generation },
        actor: { kind: 'automation', name: 'Browser Use' },
        engine: 'browser-use',
        laneKey: 'browser-use:race',
        connectionPolicy: 'single',
      }),
    });
    const ticket = (await issued.json()) as CdpBootstrapCreated;
    const version = await fetch(`${ticket.cdpUrl}/json/version`);
    const cdpUrl = String(
      ((await version.json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl,
    );
    clients.push(new WebSocket(cdpUrl), new WebSocket(cdpUrl));
    await Promise.all(
      clients.map(
        client =>
          new Promise<void>(resolve => {
            client.once('open', resolve);
            client.once('close', () => resolve());
            client.once('error', () => resolve());
          }),
      ),
    );
    await delay(20);
    const usable = clients.filter(client => client.readyState === WebSocket.OPEN);
    assert.equal(usable.length, 1);
    assert.equal((await command(usable[0]!, { id: 1, method: 'Browser.getVersion' })).id, 1);
  } finally {
    await Promise.all(clients.map(closeClient));
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
    const commandMessage = extensionMessages.find(
      (message): message is CdpCommandMessage =>
        message.type === 'cdp.command' && message.method === 'Runtime.evaluate',
    );
    assert.equal(commandMessage?.targetId, 'target-1');
    assert.equal(commandMessage?.engine, 'agent-browser');

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

test('orders an exact conversation target first and fails closed when it disappears', async () => {
  const hintedTargetId = '22222222-2222-4222-8222-222222222222';
  const otherTargetId = '33333333-3333-4333-8333-333333333333';
  let listedTargets = [target(otherTargetId), target(hintedTargetId)];
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

  const session = await createRelaySession(relay, 'target-session', hintedTargetId);
  const client = new WebSocket(session.cdpUrl);
  const received: Record<string, unknown>[] = [];
  client.on('message', data =>
    received.push(JSON.parse(data.toString()) as Record<string, unknown>),
  );
  try {
    await waitForOpen(client);
    client.send(
      JSON.stringify({
        id: 1,
        method: 'Target.setDiscoverTargets',
        params: { discover: true },
      }),
    );
    await waitForCondition(() => received.length >= 3);
    assert.deepEqual(received[0], { id: 1, result: {} });
    assert.deepEqual(
      received
        .slice(1, 3)
        .map(message => (message.params as { targetInfo: CdpTargetInfo }).targetInfo.targetId),
      [hintedTargetId, otherTargetId],
    );

    const listed = await command(client, { id: 2, method: 'Target.getTargets' });
    assert.deepEqual(
      (listed.result as { targetInfos: CdpTargetInfo[] }).targetInfos.map(item => item.targetId),
      [hintedTargetId, otherTargetId],
    );

    listedTargets = [target(otherTargetId)];
    const closed = waitForClose(client);
    const unavailable = await command(client, { id: 3, method: 'Target.getTargets' });
    assert.match(
      String((unavailable.error as { message?: string }).message),
      /conversation target is no longer available/,
    );
    assert.equal((await closed).code, 1008);
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('rejects an unavailable initial conversation target before allocating a relay session', async () => {
  const relay = await BrowserRelay.listen({
    sendToExtension: message => {
      if (message.type === 'cdp.target.request' && message.operation.kind === 'list') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            targets: [target('33333333-3333-4333-8333-333333333333')],
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);
  try {
    const response = await fetch(`http://127.0.0.1:${relay.port}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        actor: { kind: 'automation', name: 'agent-browser', sessionLabel: 'target-session' },
        initialTargetId: '22222222-2222-4222-8222-222222222222',
      }),
    });
    assert.equal(response.status, 409);
    assert.match(
      JSON.stringify(await response.json()),
      /conversation target is no longer available/,
    );
  } finally {
    await relay.close();
  }
});

test('invalidates a target-scoped bootstrap before participant allocation when the hint is stale', async () => {
  const hintedTargetId = '22222222-2222-4222-8222-222222222222';
  let listedTargets = [target(hintedTargetId)];
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
  try {
    const created = await fetch(`http://127.0.0.1:${relay.port}/cdp/bootstrap`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${relay.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        browser: { browserId: 'browser-1', generation: relay.generation },
        actor: { kind: 'automation', name: 'Playwright CLI', sessionLabel: 'target-session' },
        engine: 'playwright',
        laneKey: 'playwright:target-session',
        connectionPolicy: 'single',
        initialTargetId: hintedTargetId,
      }),
    });
    assert.equal(created.status, 201);
    const ticket = (await created.json()) as CdpBootstrapCreated;

    listedTargets = [target('33333333-3333-4333-8333-333333333333')];
    const version = await fetch(`${ticket.cdpUrl}/json/version`);
    assert.equal(version.status, 409);
    assert.deepEqual(await version.json(), {
      protocol: PANERELAY_PROTOCOL_VERSION,
      error: {
        code: 'target-unavailable',
        message: 'The Panerelay conversation target is no longer available',
      },
    });
  } finally {
    await relay.close();
  }
});

test('physically attaches Playwright targets before publishing top-level sessions', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const fixtureTarget = target(
    '22222222-2222-4222-8222-222222222222',
    'https://playwright.test/',
    true,
  );
  const otherTarget = target('33333333-3333-4333-8333-333333333333', 'https://other.test/');
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
            targets: [otherTarget, fixtureTarget],
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: {
              ...(message.targetId === fixtureTarget.targetId ? fixtureTarget : otherTarget),
              attached: true,
            },
          });
        });
      } else if (message.type === 'cdp.command') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            result:
              message.method === 'Page.getFrameTree'
                ? {
                    frameTree: {
                      frame: {
                        id: `chrome-main-frame-${message.targetId}`,
                        loaderId: 'loader-1',
                        url: fixtureTarget.url,
                        securityOrigin: 'https://playwright.test',
                        mimeType: 'text/html',
                      },
                    },
                  }
                : {},
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);
  await relay.handleExtensionMessage({
    type: 'cdp.event',
    protocol: PANERELAY_PROTOCOL_VERSION,
    targetId: fixtureTarget.targetId,
    method: 'Runtime.executionContextCreated',
    params: {
      context: {
        id: 7,
        origin: 'https://playwright.test',
        name: '',
        auxData: {
          frameId: `chrome-main-frame-${fixtureTarget.targetId}`,
          isDefault: true,
          type: 'default',
        },
      },
    },
  });

  const client = await createPlaywrightClient(relay, fixtureTarget.targetId);
  const messages: Record<string, unknown>[] = [];
  client.on('message', data => {
    messages.push(JSON.parse(data.toString()) as Record<string, unknown>);
  });
  try {
    client.send(
      JSON.stringify({
        id: 1,
        method: 'Target.setAutoAttach',
        params: { autoAttach: true, waitForDebuggerOnStart: true, flatten: true },
      }),
    );
    await waitForCondition(() => messages.length >= 3);

    assert.equal(
      extensionMessages.some(message => message.type === 'cdp.attach'),
      true,
    );
    assert.equal(messages[0]?.method, 'Target.attachedToTarget');
    assert.equal(messages[1]?.method, 'Target.attachedToTarget');
    assert.deepEqual(messages[2], { id: 1, result: {} });
    assert.equal(
      (messages[0]?.params as { targetInfo?: { targetId?: string } }).targetInfo?.targetId,
      fixtureTarget.targetId,
    );
    assert.equal(
      (messages[1]?.params as { targetInfo?: { targetId?: string } }).targetInfo?.targetId,
      otherTarget.targetId,
    );

    const attachedParams = messages[0]?.params as { sessionId?: string };
    assert.equal(typeof attachedParams.sessionId, 'string');
    assert.deepEqual(
      extensionMessages
        .filter((message): message is CdpCommandMessage => message.type === 'cdp.command')
        .slice(0, 2)
        .map(message => message.method),
      ['Target.setAutoAttach', 'Page.getFrameTree'],
    );
    const frameTree = await command(client, {
      id: 2,
      method: 'Page.getFrameTree',
      sessionId: attachedParams.sessionId,
    });
    assert.equal(
      (
        frameTree.result as {
          frameTree?: { frame?: { id?: string } };
        }
      ).frameTree?.frame?.id,
      fixtureTarget.targetId,
    );

    const lifecycleEvent = waitForMessage(client);
    await relay.handleExtensionMessage({
      type: 'cdp.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId: fixtureTarget.targetId,
      method: 'Page.lifecycleEvent',
      params: {
        frameId: `chrome-main-frame-${fixtureTarget.targetId}`,
        name: 'chrome-main-frame',
        timestamp: 1,
      },
    });
    const lifecycleParams = (await lifecycleEvent).params as {
      frameId?: string;
      name?: string;
    };
    assert.equal(lifecycleParams.frameId, fixtureTarget.targetId);
    assert.equal(lifecycleParams.name, 'chrome-main-frame');

    await command(client, {
      id: 3,
      method: 'Page.createIsolatedWorld',
      sessionId: attachedParams.sessionId,
      params: { frameId: fixtureTarget.targetId, worldName: fixtureTarget.targetId },
    });
    const isolatedWorldCommand = extensionMessages.find(
      (message): message is CdpCommandMessage =>
        message.type === 'cdp.command' && message.method === 'Page.createIsolatedWorld',
    );
    assert.equal(
      isolatedWorldCommand?.params?.frameId,
      `chrome-main-frame-${fixtureTarget.targetId}`,
    );
    assert.equal(isolatedWorldCommand?.params?.worldName, fixtureTarget.targetId);

    const runtimeMessageIndex = messages.length;
    client.send(
      JSON.stringify({
        id: 4,
        method: 'Runtime.enable',
        sessionId: attachedParams.sessionId,
      }),
    );
    await waitForCondition(() =>
      messages.some(message => message.id === 4 && message.sessionId === attachedParams.sessionId),
    );
    const runtimeMessages = messages.slice(runtimeMessageIndex);
    assert.equal(runtimeMessages[0]?.method, 'Runtime.executionContextCreated');
    assert.equal(
      (runtimeMessages[0]?.params as { context?: { auxData?: { frameId?: string } } }).context
        ?.auxData?.frameId,
      fixtureTarget.targetId,
    );
    assert.deepEqual(runtimeMessages.at(-1), {
      id: 4,
      result: {},
      sessionId: attachedParams.sessionId,
    });

    assert.deepEqual(
      await command(client, {
        id: 5,
        method: 'Target.detachFromTarget',
        params: { sessionId: attachedParams.sessionId },
      }),
      { id: 5, result: {} },
    );
    await waitForCondition(() =>
      extensionMessages.some(
        message => message.type === 'cdp.detach' && message.targetId === fixtureTarget.targetId,
      ),
    );
    assert.equal((await command(client, { id: 6, method: 'Browser.getVersion' })).id, 6);
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('publishes a Playwright-created page before returning Target.createTarget', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const createdTarget = target('playwright-created', 'about:blank');
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
            targets: [],
          });
        });
      } else if (message.type === 'cdp.target.request' && message.operation.kind === 'create') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: createdTarget,
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...createdTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            result:
              message.method === 'Page.getFrameTree'
                ? {
                    frameTree: {
                      frame: {
                        id: 'created-main-frame',
                        loaderId: 'loader-created',
                        url: createdTarget.url,
                        securityOrigin: '://',
                        mimeType: 'text/html',
                      },
                    },
                  }
                : {},
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = await createPlaywrightClient(relay);
  const messages: Record<string, unknown>[] = [];
  client.on('message', data => {
    messages.push(JSON.parse(data.toString()) as Record<string, unknown>);
  });
  try {
    client.send(
      JSON.stringify({
        id: 1,
        method: 'Target.setAutoAttach',
        params: { autoAttach: true, waitForDebuggerOnStart: true, flatten: true },
      }),
    );
    await waitForCondition(() => messages.some(message => message.id === 1));
    messages.length = 0;

    client.send(
      JSON.stringify({
        id: 2,
        method: 'Target.createTarget',
        params: {
          url: 'about:blank',
          browserContextId: 'panerelay-default',
          background: false,
          focus: false,
        },
      }),
    );
    await waitForCondition(() => messages.some(message => message.id === 2));

    assert.equal(messages[0]?.method, 'Target.attachedToTarget');
    const attachedParams = messages[0]?.params as {
      sessionId?: string;
      targetInfo?: Record<string, unknown>;
      waitingForDebugger?: boolean;
    };
    assert.equal(typeof attachedParams.sessionId, 'string');
    assert.deepEqual(attachedParams.targetInfo, {
      targetId: createdTarget.targetId,
      type: 'page',
      title: createdTarget.title,
      url: createdTarget.url,
      browserContextId: 'panerelay-default',
      attached: true,
    });
    assert.equal(attachedParams.waitingForDebugger, false);
    assert.deepEqual(messages[1], {
      id: 2,
      result: { targetId: createdTarget.targetId },
    });
    assert.deepEqual(
      extensionMessages
        .filter((message): message is CdpCommandMessage => message.type === 'cdp.command')
        .map(message => message.method),
      ['Target.setAutoAttach', 'Page.getFrameTree'],
    );

    const frameTree = await command(client, {
      id: 3,
      method: 'Page.getFrameTree',
      sessionId: attachedParams.sessionId,
    });
    assert.equal(
      (
        frameTree.result as {
          frameTree?: { frame?: { id?: string } };
        }
      ).frameTree?.frame?.id,
      createdTarget.targetId,
    );

    const detached = waitForMessage(client);
    await relay.handleExtensionMessage({
      type: 'cdp.target.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      event: 'destroyed',
      targetId: createdTarget.targetId,
    });
    assert.deepEqual(await detached, {
      method: 'Target.detachedFromTarget',
      params: {
        sessionId: attachedParams.sessionId,
        targetId: createdTarget.targetId,
      },
    });
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('rolls back a Playwright-created target when page attachment initialization fails', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const createdTarget = target('playwright-rollback', 'about:blank');
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
            targets: [],
          });
        });
      } else if (message.type === 'cdp.target.request' && message.operation.kind === 'create') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: createdTarget,
          });
        });
      } else if (message.type === 'cdp.target.request' && message.operation.kind === 'close') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.target.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
          });
        });
      } else if (message.type === 'cdp.attach') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.attached',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            success: true,
            target: { ...createdTarget, attached: true },
          });
        });
      } else if (message.type === 'cdp.command') {
        queueMicrotask(() => {
          void relay.handleExtensionMessage({
            type: 'cdp.result',
            protocol: PANERELAY_PROTOCOL_VERSION,
            requestId: message.requestId,
            ...(message.method === 'Page.getFrameTree'
              ? { error: { code: -32000, message: 'frame unavailable' } }
              : { result: {} }),
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = await createPlaywrightClient(relay);
  try {
    assert.deepEqual(
      await command(client, {
        id: 1,
        method: 'Target.setAutoAttach',
        params: { autoAttach: true, waitForDebuggerOnStart: true, flatten: true },
      }),
      { id: 1, result: {} },
    );
    assert.deepEqual(
      await command(client, {
        id: 2,
        method: 'Target.createTarget',
        params: { url: 'about:blank' },
      }),
      { id: 2, error: { code: -32000, message: 'frame unavailable' } },
    );
    assert.deepEqual(
      extensionMessages
        .filter(message => message.type === 'cdp.target.request')
        .map(message => message.operation),
      [
        { kind: 'list' },
        { kind: 'create', url: 'about:blank', active: false },
        { kind: 'close', targetId: createdTarget.targetId },
      ],
    );
  } finally {
    await closeClient(client);
    await relay.close();
  }
});

test('routes Browser Use commands with engine identity separate from its actor label', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const fixtureTarget = target('browser-use-target', 'https://example.test/', true);
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
  const client = await createBrowserUseClient(relay, 'Research Agent');
  try {
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
      params: { expression: 'document.title' },
      sessionId: pageSessionId,
    });
    const commandMessage = extensionMessages.find(
      (message): message is CdpCommandMessage =>
        message.type === 'cdp.command' && message.method === 'Runtime.evaluate',
    );
    assert.equal(commandMessage?.engine, 'browser-use');
    const sessionMessage = extensionMessages.find(
      message => message.type === 'control.session.changed',
    );
    assert.equal(sessionMessage?.session.actor.name, 'Research Agent');
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
    const virtualAttached = await attachedEvent;
    assert.equal(virtualAttached.method, 'Target.attachedToTarget');
    assert.equal(virtualAttached.sessionId, pageSessionId);
    const virtualAttachedParams = virtualAttached.params as {
      sessionId: string;
      targetInfo: Record<string, unknown>;
      waitingForDebugger: boolean;
    };
    assert.notEqual(virtualAttachedParams.sessionId, 'chrome-child-session');
    assert.notEqual(virtualAttachedParams.targetInfo.targetId, 'frame-1');
    assert.deepEqual(
      {
        ...virtualAttachedParams,
        sessionId: '<opaque-session>',
        targetInfo: { ...virtualAttachedParams.targetInfo, targetId: '<opaque-target>' },
      },
      {
        sessionId: '<opaque-session>',
        targetInfo: {
          targetId: '<opaque-target>',
          type: 'iframe',
          title: '',
          url: 'https://frame.test/',
          attached: true,
        },
        waitingForDebugger: false,
      },
    );

    const nestedAttachedEvent = waitForMessage(client);
    await relay.handleExtensionMessage({
      type: 'cdp.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId: 'target-1',
      sessionId: 'chrome-child-session',
      method: 'Target.attachedToTarget',
      params: {
        sessionId: 'chrome-nested-session',
        targetInfo: {
          targetId: 'frame-nested',
          type: 'iframe',
          title: '',
          url: 'https://nested-frame.test/',
        },
        waitingForDebugger: false,
      },
    });
    const nestedAttached = await nestedAttachedEvent;
    const nestedParams = nestedAttached.params as {
      sessionId: string;
      targetInfo: Record<string, unknown>;
    };
    assert.equal(nestedAttached.sessionId, virtualAttachedParams.sessionId);
    assert.notEqual(nestedParams.sessionId, 'chrome-nested-session');
    assert.notEqual(nestedParams.targetInfo.targetId, 'frame-nested');
    assert.ok(
      extensionMessages.some(
        message =>
          message.type === 'cdp.command' &&
          message.method === 'Target.setAutoAttach' &&
          message.sessionId === 'chrome-child-session',
      ),
      'the Bridge recursively enables non-pausing auto-attach on the child debuggee',
    );

    assert.deepEqual(
      await command(client, {
        id: 5,
        method: 'Runtime.runIfWaitingForDebugger',
        sessionId: virtualAttachedParams.sessionId,
      }),
      { id: 5, result: {}, sessionId: virtualAttachedParams.sessionId },
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

test('projects iframe targets and child sessions with participant-local identifiers', async () => {
  const fixtureTarget = target('target-iframe-owner', 'https://owner.test/', true);
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
            result: {},
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const firstParticipant = await createRelaySession(relay, 'first-iframe-participant');
  const secondParticipant = await createRelaySession(relay, 'second-iframe-participant');
  const firstClient = new WebSocket(firstParticipant.cdpUrl);
  const secondClient = new WebSocket(secondParticipant.cdpUrl);
  try {
    await Promise.all([waitForOpen(firstClient), waitForOpen(secondClient)]);
    const [firstInitialTargets, secondInitialTargets] = await Promise.all([
      command(firstClient, { id: 1, method: 'Target.getTargets' }),
      command(secondClient, { id: 1, method: 'Target.getTargets' }),
    ]);
    assert.equal((firstInitialTargets.result as { targetInfos: unknown[] }).targetInfos.length, 1);
    assert.equal((secondInitialTargets.result as { targetInfos: unknown[] }).targetInfos.length, 1);
    const [firstTopAttach, secondTopAttach] = await Promise.all([
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
    const firstTopSession = (firstTopAttach.result as { sessionId: string }).sessionId;
    await command(firstClient, {
      id: 3,
      method: 'Runtime.evaluate',
      sessionId: firstTopSession,
      params: { expression: 'document.title' },
    });

    await relay.handleExtensionMessage({
      type: 'cdp.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId: fixtureTarget.targetId,
      method: 'Target.attachedToTarget',
      params: {
        sessionId: 'chrome-oopif-session',
        targetInfo: {
          targetId: 'chrome-oopif-target',
          type: 'iframe',
          title: '',
          url: 'https://cross-origin.test/frame',
        },
        waitingForDebugger: false,
      },
    });

    const [firstTargets, secondTargets] = await Promise.all([
      command(firstClient, { id: 4, method: 'Target.getTargets' }),
      command(secondClient, { id: 3, method: 'Target.getTargets' }),
    ]);
    const firstIframe = (
      firstTargets.result as { targetInfos: Array<Record<string, unknown>> }
    ).targetInfos.find(candidate => candidate.type === 'iframe');
    const secondIframe = (
      secondTargets.result as { targetInfos: Array<Record<string, unknown>> }
    ).targetInfos.find(candidate => candidate.type === 'iframe');
    assert.ok(firstIframe);
    assert.ok(secondIframe);
    assert.notEqual(firstIframe.targetId, 'chrome-oopif-target');
    assert.notEqual(secondIframe.targetId, 'chrome-oopif-target');
    assert.notEqual(firstIframe.targetId, secondIframe.targetId);

    const crossParticipantAttach = await command(firstClient, {
      id: 5,
      method: 'Target.attachToTarget',
      params: { targetId: secondIframe.targetId, flatten: true },
    });
    assert.match(
      String((crossParticipantAttach.error as { message?: unknown }).message),
      /no longer available/,
    );

    const [firstChildAttach, secondChildAttach] = await Promise.all([
      command(firstClient, {
        id: 6,
        method: 'Target.attachToTarget',
        params: { targetId: firstIframe.targetId, flatten: true },
      }),
      command(secondClient, {
        id: 4,
        method: 'Target.attachToTarget',
        params: { targetId: secondIframe.targetId, flatten: true },
      }),
    ]);
    const firstChildSession = (firstChildAttach.result as { sessionId: string }).sessionId;
    const secondChildSession = (secondChildAttach.result as { sessionId: string }).sessionId;
    assert.notEqual(firstChildSession, secondChildSession);

    await command(firstClient, {
      id: 7,
      method: 'Runtime.evaluate',
      sessionId: firstChildSession,
      params: { expression: 'document.body.dataset.value' },
    });
    const childCommand = extensionMessages
      .filter(
        (message): message is CdpCommandMessage =>
          message.type === 'cdp.command' && message.method === 'Runtime.evaluate',
      )
      .at(-1);
    assert.equal(childCommand?.sessionId, 'chrome-oopif-session');

    const firstChildEvent = waitForMessage(firstClient);
    const secondChildEvent = waitForMessage(secondClient);
    await relay.handleExtensionMessage({
      type: 'cdp.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId: fixtureTarget.targetId,
      sessionId: 'chrome-oopif-session',
      method: 'Runtime.consoleAPICalled',
      params: { type: 'log' },
    });
    assert.deepEqual(await firstChildEvent, {
      method: 'Runtime.consoleAPICalled',
      params: { type: 'log' },
      sessionId: firstChildSession,
    });
    assert.deepEqual(await secondChildEvent, {
      method: 'Runtime.consoleAPICalled',
      params: { type: 'log' },
      sessionId: secondChildSession,
    });

    const firstDetached = waitForMessage(firstClient);
    const secondDetached = waitForMessage(secondClient);
    await relay.handleExtensionMessage({
      type: 'cdp.event',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId: fixtureTarget.targetId,
      method: 'Target.detachedFromTarget',
      params: { sessionId: 'chrome-oopif-session' },
    });
    assert.deepEqual(await firstDetached, {
      method: 'Inspector.detached',
      params: { reason: 'Chrome detached the child target' },
      sessionId: firstChildSession,
    });
    assert.deepEqual(await secondDetached, {
      method: 'Inspector.detached',
      params: { reason: 'Chrome detached the child target' },
      sessionId: secondChildSession,
    });
    assert.equal(
      (
        (await command(firstClient, { id: 8, method: 'Target.getTargets' })).result as {
          targetInfos: Array<Record<string, unknown>>;
        }
      ).targetInfos.some(candidate => candidate.type === 'iframe'),
      false,
    );
    assert.equal((secondTopAttach.result as { sessionId: string }).sessionId.length > 0, true);
  } finally {
    await Promise.all([closeClient(firstClient), closeClient(secondClient)]);
    await relay.close();
  }
});

test('scopes focus emulation to Input participants and restores an observed target', async () => {
  const fixtureTarget = target('target-focus', 'https://focus.test/', true);
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
            result: {},
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const inputParticipant = await createRelaySession(relay, 'input-participant');
  const observerParticipant = await createRelaySession(relay, 'observer-participant');
  const inputClient = new WebSocket(inputParticipant.cdpUrl);
  const observerClient = new WebSocket(observerParticipant.cdpUrl);
  try {
    await Promise.all([waitForOpen(inputClient), waitForOpen(observerClient)]);
    await Promise.all([
      command(inputClient, { id: 1, method: 'Target.getTargets' }),
      command(observerClient, { id: 1, method: 'Target.getTargets' }),
    ]);
    const [inputAttach, observerAttach] = await Promise.all([
      command(inputClient, {
        id: 2,
        method: 'Target.attachToTarget',
        params: { targetId: fixtureTarget.targetId, flatten: true },
      }),
      command(observerClient, {
        id: 2,
        method: 'Target.attachToTarget',
        params: { targetId: fixtureTarget.targetId, flatten: true },
      }),
    ]);
    const inputSessionId = (inputAttach.result as { sessionId: string }).sessionId;
    const observerSessionId = (observerAttach.result as { sessionId: string }).sessionId;

    assert.deepEqual(
      await command(inputClient, {
        id: 3,
        method: 'Input.dispatchKeyEvent',
        sessionId: inputSessionId,
        params: { type: 'keyDown', key: 'A' },
      }),
      { id: 3, result: {}, sessionId: inputSessionId },
    );
    assert.deepEqual(
      extensionMessages
        .filter((message): message is CdpCommandMessage => message.type === 'cdp.command')
        .map(message => [message.method, message.params]),
      [
        [
          'Target.setAutoAttach',
          { autoAttach: true, waitForDebuggerOnStart: false, flatten: true },
        ],
        ['Emulation.setFocusEmulationEnabled', { enabled: true }],
        ['Input.dispatchKeyEvent', { type: 'keyDown', key: 'A' }],
      ],
    );

    const release = await fetch(
      `http://127.0.0.1:${relay.port}/sessions/${inputParticipant.sessionId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${relay.token}` },
      },
    );
    assert.equal(release.status, 204);
    await waitForCondition(() =>
      extensionMessages.some(
        message =>
          message.type === 'cdp.command' &&
          message.method === 'Emulation.setFocusEmulationEnabled' &&
          message.params?.enabled === false,
      ),
    );
    assert.equal(
      extensionMessages.some(message => message.type === 'cdp.detach'),
      false,
      'the remaining observer keeps the physical debugger attachment',
    );

    assert.deepEqual(
      await command(observerClient, {
        id: 3,
        method: 'Runtime.evaluate',
        sessionId: observerSessionId,
        params: { expression: 'document.title' },
      }),
      { id: 3, result: {}, sessionId: observerSessionId },
    );
  } finally {
    await Promise.all([closeClient(inputClient), closeClient(observerClient)]);
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

test('rejects Playwright browser ownership, isolated context, proxy, and close requests locally', async () => {
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
            targets: [],
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const client = await createPlaywrightClient(relay);
  try {
    assert.deepEqual(
      await command(client, {
        id: 1,
        method: 'Target.createBrowserContext',
        params: { proxyServer: 'http://127.0.0.1:9999' },
      }),
      {
        id: 1,
        error: {
          code: -32601,
          message: 'Target.createBrowserContext is not supported by Panerelay',
        },
      },
    );
    assert.deepEqual(await command(client, { id: 2, method: 'Browser.close' }), {
      id: 2,
      error: {
        code: -32000,
        message:
          'Browser.close requires browser-process ownership and is not supported by Panerelay',
      },
    });
    assert.equal(
      extensionMessages.some(
        message =>
          message.type === 'cdp.command' ||
          (message.type === 'cdp.target.request' && message.operation.kind !== 'list'),
      ),
      false,
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
        'Target.setAutoAttach',
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
        if (message.method === 'Target.setAutoAttach' || message.method === 'Page.getFrameTree') {
          queueMicrotask(() => {
            void relay.handleExtensionMessage({
              type: 'cdp.result',
              protocol: PANERELAY_PROTOCOL_VERSION,
              requestId: message.requestId,
              result:
                message.method === 'Page.getFrameTree'
                  ? {
                      frameTree: {
                        frame: {
                          id: 'shared-main-frame',
                          loaderId: 'loader-shared',
                          url: fixtureTarget.url,
                          securityOrigin: 'https://shared.test',
                          mimeType: 'text/html',
                        },
                      },
                    }
                  : {},
            });
          });
          return;
        }
        forwardedCommands.push(message);
        if (forwardedCommands.length === 1) resolveFirstForwarded?.();
        if (forwardedCommands.length === 2) resolveSecondForwarded?.();
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const firstClient = await createBrowserUseClient(relay);
  const secondClient = await createPlaywrightClient(relay);
  try {
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
    assert.deepEqual(
      forwardedCommands.map(message => message.engine),
      ['browser-use', 'playwright'],
    );

    assert.equal(extensionMessages.filter(message => message.type === 'cdp.attach').length, 1);
    await closeClient(firstClient);
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

test('tracks ordered participant control claims and downgrades shared attachments', async () => {
  const fixtureTarget = target('target-claims', 'https://claims.test/', true);
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
            ...(message.engine === 'playwright' && message.method === 'Runtime.evaluate'
              ? { error: { code: -32000, message: 'Synthetic Playwright failure' } }
              : { result: {} }),
          });
        });
      }
    },
    onBrowserRegistered: () => undefined,
    onBrowserDisconnected: () => undefined,
  });
  await register(relay);

  const observer = new WebSocket((await createRelaySession(relay, 'observer')).cdpUrl);
  await waitForOpen(observer);
  const browserUse = await createBrowserUseClient(relay);
  const playwright = await createPlaywrightClient(relay);
  try {
    for (const [client, id] of [
      [observer, 1],
      [browserUse, 1],
      [playwright, 1],
    ] as const) {
      await command(client, { id, method: 'Target.getTargets' });
    }
    const observerSession = (
      await command(observer, {
        id: 2,
        method: 'Target.attachToTarget',
        params: { targetId: fixtureTarget.targetId, flatten: true },
      })
    ).result as { sessionId: string };
    const browserUseSession = (
      await command(browserUse, {
        id: 2,
        method: 'Target.attachToTarget',
        params: { targetId: fixtureTarget.targetId, flatten: true },
      })
    ).result as { sessionId: string };
    const playwrightSession = (
      await command(playwright, {
        id: 2,
        method: 'Target.attachToTarget',
        params: { targetId: fixtureTarget.targetId, flatten: true },
      })
    ).result as { sessionId: string };

    await command(observer, {
      id: 3,
      method: 'Page.enable',
      sessionId: observerSession.sessionId,
    });
    await command(browserUse, {
      id: 3,
      method: 'Runtime.evaluate',
      sessionId: browserUseSession.sessionId,
      params: { expression: '1' },
    });
    const failed = await command(playwright, {
      id: 3,
      method: 'Runtime.evaluate',
      sessionId: playwrightSession.sessionId,
      params: { expression: '2' },
    });
    assert.deepEqual(failed.error, { code: -32000, message: 'Synthetic Playwright failure' });
    await command(browserUse, {
      id: 4,
      method: 'Runtime.evaluate',
      sessionId: browserUseSession.sessionId,
      params: { expression: '3' },
    });

    await closeClient(browserUse);
    await waitForCondition(() =>
      extensionMessages.some(
        (message): message is CdpControlUpdatedMessage =>
          message.type === 'cdp.control.updated' &&
          message.targetId === fixtureTarget.targetId &&
          message.engine === 'playwright',
      ),
    );
    assert.equal(
      extensionMessages.some(
        message => message.type === 'cdp.detach' && message.targetId === fixtureTarget.targetId,
      ),
      false,
    );

    await closeClient(playwright);
    await waitForCondition(() =>
      extensionMessages.some(
        (message): message is CdpControlUpdatedMessage =>
          message.type === 'cdp.control.updated' &&
          message.targetId === fixtureTarget.targetId &&
          message.engine === null,
      ),
    );
    assert.ok(
      extensionMessages.some(
        message =>
          message.type === 'control.session.changed' &&
          message.session.controlledTargetCount === 0 &&
          message.session.observedTargetCount === 1,
      ),
    );
    assert.equal(
      extensionMessages.some(
        message => message.type === 'cdp.detach' && message.targetId === fixtureTarget.targetId,
      ),
      false,
    );
    assert.equal((await command(observer, { id: 4, method: 'Browser.getVersion' })).id, 4);
  } finally {
    await closeClient(browserUse);
    await closeClient(playwright);
    await closeClient(observer);
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
        if (message.method === 'Target.setAutoAttach') {
          queueMicrotask(() => {
            void relay.handleExtensionMessage({
              type: 'cdp.result',
              protocol: PANERELAY_PROTOCOL_VERSION,
              requestId: message.requestId,
              result: {},
            });
          });
          return;
        }
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
