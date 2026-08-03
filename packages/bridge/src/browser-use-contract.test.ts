import assert from 'node:assert/strict';
import test from 'node:test';
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

test('CLI and adapter resolve the stable Browser Use gateway without allocating a participant', async () => {
  const extensionMessages: HostToExtensionMessage[] = [];
  const relay = await BrowserRelay.listen({
    bootstrapMaxOutstandingTickets: 1,
    bootstrapTicketTtlMs: 100,
    onBrowserDisconnected: () => {},
    onBrowserRegistered: () => {},
    sendToExtension: message => extensionMessages.push(message),
  });
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
            skipAdapterIntegrityChecksForTesting: true,
            readAdapterMode: async () => 'extension',
            readAdapterRegistration: async () => registration,
            selectBrowserRegistration: async () => selection,
            invokeAdapter: async (_registration, request) =>
              handleBrowserUseAdapterRequest(request, { adapterVersion: '0.2.0' }),
          },
        },
      );
    const sessionMessages = () =>
      extensionMessages.filter(message => message.type === 'control.session.changed');

    const first = await resolve();
    assert.equal(first.connection.kind, 'cdp-http');
    assert.equal(first.connection.url, 'http://127.0.0.1:43827/cdp/browser-use');
    assert.equal(sessionMessages().length, 0, 'ticket issuance must allocate no participant');
    const ignoredByHealthyDaemon = await resolve();
    assert.equal(ignoredByHealthyDaemon.connection.kind, 'cdp-http');
    assert.equal(ignoredByHealthyDaemon.connection.url, first.connection.url);
    assert.equal(sessionMessages().length, 0);
  } finally {
    await relay.close();
  }
});
