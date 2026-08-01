import assert from 'node:assert/strict';
import test from 'node:test';
import type { BrowserRegistryOptions, BrowserSelection } from '@panerelay/browser-registry';
import {
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  type CliAdapterRequest,
  type CliAdapterResolvedConnection,
  type CliAdapterResponse,
} from '@panerelay/protocol';
import {
  CliAdapterDispatchError,
  resolveCliAdapterSpawn,
  resolveCliConnection,
  saveCliConnectionMode,
} from './adapter-dispatcher.js';
import type { CliAdapterRegistration } from './adapter-registry.js';

const registration: CliAdapterRegistration = {
  adapterId: 'browser-use',
  version: '0.2.0',
  executablePath: '/protected/panerelay/adapters/browser-use',
  protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  capabilities: ['connection.resolve', 'adapter.doctor'],
  modes: ['direct', 'extension'],
  childEnvironmentKeys: ['BU_CDP_URL', 'BU_NAME'],
};

const selection: BrowserSelection = {
  source: 'explicit',
  state: {
    protocol: 'panerelay.relay.v1',
    pid: 123,
    port: 41_234,
    token: 'bridge-token-never-forwarded',
    generation: 'native-host-generation-1',
    browserId: 'opaque-browser',
    browserName: 'Chrome',
    browserFamily: 'chrome',
    capabilities: { cdpRelay: true },
    extensionVersion: '0.2.0',
    extensionId: 'extension-id',
    updatedAt: '2026-08-01T01:02:03.000Z',
  },
};

test('launches registered Windows command adapters through the exact command interpreter', () => {
  assert.deepEqual(
    resolveCliAdapterSpawn(
      'C:\\Users\\Test User\\.panerelay\\bin\\adapter.cmd',
      'win32',
      'C:\\Windows\\System32\\cmd.exe',
    ),
    {
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', '"C:\\Users\\Test^ User\\.panerelay\\bin\\adapter.cmd"'],
      windowsVerbatimArguments: true,
    },
  );
  assert.deepEqual(resolveCliAdapterSpawn('/protected/adapter', 'linux'), {
    command: '/protected/adapter',
    args: [],
  });
});

function success(request: CliAdapterRequest): CliAdapterResponse {
  return {
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    requestId: request.requestId,
    operation: 'connection.resolve',
    success: true,
    result: {
      mode: 'extension',
      connection: { kind: 'cdp-http', url: 'http://127.0.0.1:41234/cdp/bootstrap/ticket' },
      environment: {
        BU_CDP_URL: 'http://127.0.0.1:41234/cdp/bootstrap/ticket',
        BU_NAME: 'panerelay',
      },
      expiresAt: '2099-08-01T02:02:03.000Z',
      concurrencyKey: 'browser-use-lane',
    },
  };
}

test('defaults to Direct without selecting a browser or invoking the adapter', async () => {
  let selected = false;
  let invoked = false;
  const result = await resolveCliConnection(
    { adapterId: 'browser-use', actor: { name: 'Browser Use' } },
    {
      dependencies: {
        readAdapterRegistration: async () => registration,
        readAdapterMode: async () => null,
        selectBrowserRegistration: async (_options?: BrowserRegistryOptions) => {
          selected = true;
          return selection;
        },
        invokeAdapter: async () => {
          invoked = true;
          throw new Error('must not run');
        },
      },
    },
  );
  assert.deepEqual(result, {
    adapterId: 'browser-use',
    mode: 'direct',
    connection: { kind: 'direct' },
    environment: {},
  });
  assert.equal(selected, false);
  assert.equal(invoked, false);
});

test('applies an Extension one-run override without mutating the saved mode', async () => {
  let selectedEnvironment: NodeJS.ProcessEnv | undefined;
  let resolveRequest: CliAdapterRequest | undefined;
  let writes = 0;
  const result = await resolveCliConnection(
    {
      adapterId: 'browser-use',
      actor: { name: 'Browser Use', sessionLabel: 'skill-run' },
      browserSelector: 'chrome',
      mode: 'extension',
    },
    {
      environment: { PANERELAY_BROWSER_ID: 'ambient-browser' },
      dependencies: {
        readAdapterRegistration: async () => registration,
        readAdapterMode: async () => 'direct',
        setAdapterMode: async () => {
          writes += 1;
        },
        selectBrowserRegistration: async options => {
          selectedEnvironment = options?.environment;
          return selection;
        },
        invokeAdapter: async (_registration, request) => {
          resolveRequest = request;
          return success(request);
        },
      },
    },
  );
  assert.equal(selectedEnvironment?.PANERELAY_BROWSER_ID, undefined);
  assert.equal(selectedEnvironment?.PANERELAY_BROWSER, 'chrome');
  assert.equal(resolveRequest?.operation, 'connection.resolve');
  if (resolveRequest?.operation !== 'connection.resolve') assert.fail('missing resolve request');
  assert.deepEqual(resolveRequest.input.browser, {
    browserId: 'opaque-browser',
    generation: 'native-host-generation-1',
  });
  assert.equal(JSON.stringify(resolveRequest).includes('bridge-token'), false);
  assert.equal(result.connection.kind, 'cdp-http');
  assert.equal(writes, 0);
});

test('rejects undeclared child environment and saves only supported modes', async () => {
  const dependencies = {
    readAdapterRegistration: async () => registration,
    readAdapterMode: async () => 'extension' as const,
    selectBrowserRegistration: async () => selection,
    invokeAdapter: async (_registration: CliAdapterRegistration, request: CliAdapterRequest) => {
      const response = success(request);
      if (response.success && response.operation === 'connection.resolve') {
        (response.result as CliAdapterResolvedConnection).environment.PATH = '/malicious';
      }
      return response;
    },
  };
  await assert.rejects(
    resolveCliConnection(
      { adapterId: 'browser-use', actor: { name: 'Browser Use' } },
      { dependencies },
    ),
    (error: unknown) =>
      error instanceof CliAdapterDispatchError && error.code === 'adapter-invalid-response',
  );

  let saved: string | undefined;
  await saveCliConnectionMode('browser-use', 'extension', {
    dependencies: {
      readAdapterRegistration: async () => registration,
      setAdapterMode: async (_adapterId, mode) => {
        saved = mode;
      },
    },
  });
  assert.equal(saved, 'extension');
});
