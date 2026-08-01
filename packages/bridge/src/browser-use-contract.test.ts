import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket from 'ws';
import {
  BROWSER_USE_CHILD_ENVIRONMENT_KEYS,
  handleBrowserUseAdapterRequest,
} from '@panerelay/browser-use';
import { resolveCliConnection, type CliAdapterRegistration } from '@panerelay/cli';
import type { BrowserSelection } from '@panerelay/browser-registry';
import {
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  PANERELAY_PROTOCOL_VERSION,
  type BridgeState,
  type HostToExtensionMessage,
} from '@panerelay/protocol';
import { BrowserRelay } from './browser-relay.js';

function waitForOpen(client: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once('open', resolve);
    client.once('error', reject);
  });
}

function closeClient(client: WebSocket): Promise<void> {
  if (client.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise(resolve => {
    client.once('close', resolve);
    client.close();
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

test('CLI and adapter preserve lazy bootstrap allocation across a healthy daemon reuse contract', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    bootstrapMaxOutstandingTickets: 1,
    bootstrapTicketTtlMs: 30,
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => extensionMessages.push(message),
  });
  let client: WebSocket | null = null;
  try {
    await relay.handleExtensionMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'browser-use-contract-browser',
      browserName: 'Contract Chrome',
      browserFamily: 'chrome',
      capabilities: { cdpRelay: true },
      extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
      extensionVersion: '0.2.0',
    });
    const state: BridgeState = {
      protocol: PANERELAY_PROTOCOL_VERSION,
      pid: process.pid,
      port: relay.port,
      token: relay.token,
      generation: relay.generation,
      browserId: 'browser-use-contract-browser',
      browserName: 'Contract Chrome',
      browserFamily: 'chrome',
      capabilities: { cdpRelay: true },
      extensionVersion: '0.2.0',
      extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
      updatedAt: new Date().toISOString(),
    };
    const selection: BrowserSelection = { source: 'single', state };
    const registration: CliAdapterRegistration = {
      adapterId: 'browser-use',
      version: '0.2.0',
      executablePath: '/protected/panerelay/browser-use-adapter',
      protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
      capabilities: ['connection.resolve', 'adapter.doctor'],
      modes: ['direct', 'extension'],
      childEnvironmentKeys: [...BROWSER_USE_CHILD_ENVIRONMENT_KEYS],
    };
    const resolve = () =>
      resolveCliConnection(
        { adapterId: 'browser-use', actor: { name: 'Browser Use contract' } },
        {
          dependencies: {
            readAdapterMode: async () => 'extension',
            readAdapterRegistration: async () => registration,
            selectBrowserRegistration: async () => selection,
            invokeAdapter: async (_registration, request) =>
              handleBrowserUseAdapterRequest(request, {
                adapterVersion: '0.2.0',
                readLiveBrowserRegistration: async () => state,
              }),
          },
        },
      );
    const sessionMessages = () =>
      extensionMessages.filter(message => message.type === 'control.session.changed');

    const first = await resolve();
    assert.equal(first.connection.kind, 'cdp-http');
    assert.equal(sessionMessages().length, 0, 'ticket issuance must allocate no participant');
    const version = await fetch(`${first.connection.url}/json/version`);
    assert.equal(version.status, 200);
    const metadata = (await version.json()) as { webSocketDebuggerUrl: string };
    assert.equal(sessionMessages().length, 1, 'version resolution allocates one participant');
    assert.equal(sessionMessages()[0]?.session.participantCount, 1);

    const repeatedVersion = await fetch(`${first.connection.url}/json/version`);
    assert.equal(repeatedVersion.status, 200);
    assert.equal(sessionMessages().length, 1, 'repeated version resolution is idempotent');

    client = new WebSocket(metadata.webSocketDebuggerUrl);
    await waitForOpen(client);
    const afterConnectMessages = sessionMessages().length;
    assert.ok(afterConnectMessages >= 1);
    assert.equal(
      sessionMessages().every(message => message.session.participantCount === 1),
      true,
    );

    const ignoredByHealthyDaemon = await resolve();
    assert.equal(ignoredByHealthyDaemon.connection.kind, 'cdp-http');
    assert.equal(sessionMessages().length, afterConnectMessages);
    await delay(50);

    const afterUnusedExpiry = await resolve();
    assert.equal(afterUnusedExpiry.connection.kind, 'cdp-http');
    assert.equal(sessionMessages().length, afterConnectMessages);
    assert.equal(
      sessionMessages().every(message => message.session.participantCount === 1),
      true,
      'unused ticket expiry must not consume participant capacity',
    );
  } finally {
    if (client) await closeClient(client);
    await relay.close();
  }
});
