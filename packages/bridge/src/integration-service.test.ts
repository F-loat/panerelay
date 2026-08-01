import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  PANERELAY_PROTOCOL_VERSION,
  type BridgeState,
  type HostToExtensionMessage,
  type IntegrationRequest,
} from '@panerelay/protocol';
import type { CliAdapterRegistration } from '@panerelay/cli/adapter-config';
import { IntegrationService } from './integration-service.js';

const browserUseAdapter: CliAdapterRegistration = {
  adapterId: 'browser-use',
  version: '0.2.0',
  executablePath: '/protected/panerelay/browser-use-adapter',
  protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  capabilities: ['connection.resolve', 'adapter.doctor'],
  modes: ['direct', 'extension'],
  childEnvironmentKeys: [],
};

const currentBrowser: BridgeState = {
  protocol: PANERELAY_PROTOCOL_VERSION,
  pid: process.pid,
  port: 41_234,
  token: 'not-returned',
  generation: 'generation-edge',
  browserId: 'edge-browser-id',
  browserName: 'Microsoft Edge',
  browserFamily: 'edge',
  capabilities: { cdpRelay: true },
  extensionVersion: '0.2.0',
  extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
  updatedAt: '2026-07-31T08:00:00.000Z',
};

function request(method: IntegrationRequest['method'], requestId: string = method) {
  return {
    type: 'integration.request' as const,
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId,
    request: { method } as IntegrationRequest,
  };
}

test('routes default-provider integration operations and returns current state', async () => {
  const sent: HostToExtensionMessage[] = [];
  const calls: string[] = [];
  const service = new IntegrationService(message => sent.push(message), {
    readDefaultProvider: async () => {
      calls.push('get');
      return { path: '/config', provider: null, isPanerelay: false };
    },
    setDefaultProvider: async () => {
      calls.push('set');
      return { path: '/config', provider: 'panerelay', isPanerelay: true };
    },
    clearDefaultProvider: async () => {
      calls.push('clear');
      return { path: '/config', provider: null, isPanerelay: false };
    },
  });

  await service.handle(request('default-provider.get'));
  await service.handle(request('default-provider.set'));
  await service.handle(request('default-provider.clear'));

  assert.deepEqual(calls, ['get', 'set', 'clear']);
  assert.deepEqual(
    sent.map(message =>
      message.type === 'integration.response'
        ? { success: message.success, result: message.result }
        : message,
    ),
    [
      { success: true, result: { provider: null, isPanerelay: false } },
      { success: true, result: { provider: 'panerelay', isPanerelay: true } },
      { success: true, result: { provider: null, isPanerelay: false } },
    ],
  );
});

test('manages the Browser Use connection default independently from agent-browser', async () => {
  const sent: HostToExtensionMessage[] = [];
  const calls: string[] = [];
  let mode: 'direct' | 'extension' | null = null;
  const service = new IntegrationService(message => sent.push(message), {
    readBrowserUseAdapter: async () => browserUseAdapter,
    readBrowserUseMode: async () => mode,
    setBrowserUseMode: async nextMode => {
      calls.push(`browser-use:${nextMode}`);
      mode = nextMode;
    },
    setDefaultProvider: async () => {
      calls.push('agent-browser:set');
      return { path: '/config', provider: 'panerelay', isPanerelay: true };
    },
  });

  await service.handle(request('browser-use-default.get'));
  await service.handle(request('browser-use-default.set'));
  await service.handle(request('default-provider.set'));
  await service.handle(request('browser-use-default.clear'));

  assert.deepEqual(calls, ['browser-use:extension', 'agent-browser:set', 'browser-use:direct']);
  assert.deepEqual(
    sent.map(message => (message.type === 'integration.response' ? message.result : undefined)),
    [
      { available: true, mode: 'direct', isPanerelay: false },
      { available: true, mode: 'extension', isPanerelay: true },
      { provider: 'panerelay', isPanerelay: true },
      { available: true, mode: 'direct', isPanerelay: false },
    ],
  );
});

test('reports an unavailable Browser Use integration and rejects its mutation', async () => {
  const sent: HostToExtensionMessage[] = [];
  let writes = 0;
  const service = new IntegrationService(message => sent.push(message), {
    readBrowserUseAdapter: async () => null,
    setBrowserUseMode: async () => {
      writes += 1;
    },
  });

  await service.handle(request('browser-use-default.get', 'browser-use-get'));
  await service.handle(request('browser-use-default.set', 'browser-use-set'));

  assert.equal(writes, 0);
  assert.deepEqual(sent, [
    {
      type: 'integration.response',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: 'browser-use-get',
      success: true,
      result: { available: false, mode: null, isPanerelay: false },
    },
    {
      type: 'integration.response',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: 'browser-use-set',
      success: false,
      error: 'The Panerelay Browser Use integration is not available',
    },
  ]);
});

test('returns a correlated Browser Use default error for invalid protected state', async () => {
  const sent: HostToExtensionMessage[] = [];
  const service = new IntegrationService(message => sent.push(message), {
    readBrowserUseAdapter: async () => {
      throw new Error('Panerelay CLI adapter registry is invalid');
    },
  });

  await service.handle(request('browser-use-default.get', 'browser-use-invalid'));

  assert.deepEqual(sent, [
    {
      type: 'integration.response',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: 'browser-use-invalid',
      success: false,
      error: 'Panerelay CLI adapter registry is invalid',
    },
  ]);
});

test('returns a correlated error when configuration cannot be read', async () => {
  const sent: HostToExtensionMessage[] = [];
  const service = new IntegrationService(message => sent.push(message), {
    readDefaultProvider: async () => {
      throw new Error('Invalid agent-browser configuration');
    },
  });

  await service.handle(request('default-provider.get', 'settings-1'));

  assert.deepEqual(sent, [
    {
      type: 'integration.response',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: 'settings-1',
      success: false,
      error: 'Invalid agent-browser configuration',
    },
  ]);
});

test('returns a validated workspace directory or cancellation', async () => {
  const sent: HostToExtensionMessage[] = [];
  let selected: string | null = '/workspace/project';
  const service = new IntegrationService(message => sent.push(message), {
    pickDirectory: async () => selected,
  });

  await service.handle(request('workspace.pick-directory', 'workspace-1'));
  selected = null;
  await service.handle(request('workspace.pick-directory', 'workspace-2'));

  assert.deepEqual(
    sent.map(message => (message.type === 'integration.response' ? message.result : undefined)),
    [{ path: '/workspace/project' }, { path: null }],
  );
});

test('manages only the registered current browser as the routing default', async () => {
  const sent: HostToExtensionMessage[] = [];
  let savedBrowserId: string | null = 'chrome-browser-id';
  const calls: string[] = [];
  const service = new IntegrationService(message => sent.push(message), {
    currentBrowser: () => currentBrowser,
    listBrowsers: async () => [
      { state: currentBrowser, ready: true },
      {
        state: { ...currentBrowser, browserId: 'chrome-browser-id', browserName: 'Google Chrome' },
        ready: true,
      },
    ],
    readBrowserDefault: async () =>
      savedBrowserId
        ? {
            protocol: PANERELAY_PROTOCOL_VERSION,
            browserId: savedBrowserId,
            updatedAt: '2026-07-31T08:00:00.000Z',
          }
        : null,
    setBrowserDefault: async browserId => {
      calls.push(`set:${browserId}`);
      savedBrowserId = browserId;
      return {
        protocol: PANERELAY_PROTOCOL_VERSION,
        browserId,
        updatedAt: '2026-07-31T08:01:00.000Z',
      };
    },
    clearBrowserDefault: async expectedBrowserId => {
      calls.push(`clear:${expectedBrowserId}`);
      if (savedBrowserId === expectedBrowserId) savedBrowserId = null;
      return savedBrowserId
        ? {
            protocol: PANERELAY_PROTOCOL_VERSION,
            browserId: savedBrowserId,
            updatedAt: '2026-07-31T08:02:00.000Z',
          }
        : null;
    },
  });

  await service.handle(request('browser-default.get'));
  await service.handle(request('browser-default.set-current'));
  await service.handle(request('browser-default.clear-current'));

  assert.deepEqual(calls, ['set:edge-browser-id', 'clear:edge-browser-id']);
  assert.deepEqual(
    sent.map(message =>
      message.type === 'integration.response'
        ? { success: message.success, result: message.result }
        : message,
    ),
    [
      {
        success: true,
        result: {
          currentBrowser: {
            browserId: 'edge-browser-id',
            browserName: 'Microsoft Edge',
            browserFamily: 'edge',
          },
          defaultBrowserId: 'chrome-browser-id',
          hasMultipleBrowsers: true,
          isCurrentBrowser: false,
        },
      },
      {
        success: true,
        result: {
          currentBrowser: {
            browserId: 'edge-browser-id',
            browserName: 'Microsoft Edge',
            browserFamily: 'edge',
          },
          defaultBrowserId: 'edge-browser-id',
          hasMultipleBrowsers: true,
          isCurrentBrowser: true,
        },
      },
      {
        success: true,
        result: {
          currentBrowser: {
            browserId: 'edge-browser-id',
            browserName: 'Microsoft Edge',
            browserFamily: 'edge',
          },
          defaultBrowserId: null,
          hasMultipleBrowsers: true,
          isCurrentBrowser: false,
        },
      },
    ],
  );
});

test('reports that browser default choice is not meaningful with one live browser', async () => {
  const sent: HostToExtensionMessage[] = [];
  const service = new IntegrationService(message => sent.push(message), {
    currentBrowser: () => currentBrowser,
    listBrowsers: async () => [{ state: currentBrowser, ready: true }],
    readBrowserDefault: async () => null,
  });

  await service.handle(request('browser-default.get'));

  assert.deepEqual(
    sent.map(message => (message.type === 'integration.response' ? message.result : undefined)),
    [
      {
        currentBrowser: {
          browserId: 'edge-browser-id',
          browserName: 'Microsoft Edge',
          browserFamily: 'edge',
        },
        defaultBrowserId: null,
        hasMultipleBrowsers: false,
        isCurrentBrowser: false,
      },
    ],
  );
});

test('rejects browser-default mutation before the current browser registers', async () => {
  const sent: HostToExtensionMessage[] = [];
  const service = new IntegrationService(message => sent.push(message));

  await service.handle(request('browser-default.set-current', 'browser-default-1'));

  assert.deepEqual(sent, [
    {
      type: 'integration.response',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: 'browser-default-1',
      success: false,
      error: 'The current browser is not registered with Panerelay',
    },
  ]);
});
