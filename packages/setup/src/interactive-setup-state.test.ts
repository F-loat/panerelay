import assert from 'node:assert/strict';
import test from 'node:test';
import { readInteractiveSetupState } from './interactive-setup-state.js';

const registration = (adapterId: string): never => ({ adapterId }) as never;

test('derives all configured integrations and an unambiguous Panerelay default', async () => {
  const state = await readInteractiveSetupState(
    { environment: { HOME: '/tmp/panerelay-state-home' } },
    {
      readAdapterMode: async () => 'extension',
      readAdapterRegistration: async adapterId => registration(adapterId),
      readAgentBrowserState: async () => ({
        isPanerelayDefault: true,
        providerAvailable: true,
      }),
    },
  );
  assert.deepEqual(state, {
    defaultIntegrations: ['agentBrowser', 'browserUse'],
    globalDefault: true,
    integrations: ['agentBrowser', 'browserUse', 'playwright'],
  });
});

test('derives partial and empty configured integration state', async () => {
  assert.deepEqual(
    await readInteractiveSetupState(
      {},
      {
        readAdapterMode: async () => null,
        readAdapterRegistration: async adapterId =>
          adapterId === 'playwright' ? registration(adapterId) : null,
        readAgentBrowserState: async () => ({
          isPanerelayDefault: false,
          providerAvailable: true,
        }),
      },
    ),
    {
      defaultIntegrations: [],
      globalDefault: false,
      integrations: ['agentBrowser', 'playwright'],
    },
  );
  assert.deepEqual(
    await readInteractiveSetupState(
      {},
      {
        readAdapterMode: async () => null,
        readAdapterRegistration: async () => null,
        readAgentBrowserState: async () => ({
          isPanerelayDefault: false,
          providerAvailable: false,
        }),
      },
    ),
    { defaultIntegrations: [], globalDefault: false, integrations: [] },
  );
});

test('uses No when selected default-capable integrations have mixed current defaults', async () => {
  assert.deepEqual(
    await readInteractiveSetupState(
      {},
      {
        readAdapterMode: async () => 'direct',
        readAdapterRegistration: async adapterId =>
          adapterId === 'browser-use' ? registration(adapterId) : null,
        readAgentBrowserState: async () => ({
          isPanerelayDefault: true,
          providerAvailable: true,
        }),
      },
    ),
    {
      defaultIntegrations: ['agentBrowser'],
      globalDefault: false,
      integrations: ['agentBrowser', 'browserUse'],
    },
  );
});

test('contains malformed or unprotected readers and keeps other valid state', async () => {
  assert.deepEqual(
    await readInteractiveSetupState(
      {},
      {
        readAdapterMode: async () => {
          throw new Error('preferences permissions are too broad');
        },
        readAdapterRegistration: async adapterId => {
          if (adapterId === 'browser-use') throw new Error('registry is invalid');
          return registration(adapterId);
        },
        readAgentBrowserState: async () => {
          throw new Error('provider config is invalid');
        },
      },
    ),
    { defaultIntegrations: [], globalDefault: false, integrations: ['playwright'] },
  );
});

test('passes the explicit home and protected adapter directory without probing executables', async () => {
  const calls: unknown[] = [];
  await readInteractiveSetupState(
    {
      dataDirectory: '/tmp/panerelay-state-data',
      environment: { HOME: '/tmp/ignored-home' },
      homeDirectory: '/tmp/panerelay-state-home',
      platform: 'linux',
    },
    {
      readAdapterMode: async (adapterId, options) => {
        calls.push(['mode', adapterId, options]);
        return null;
      },
      readAdapterRegistration: async (adapterId, options) => {
        calls.push(['registration', adapterId, options]);
        return null;
      },
      readAgentBrowserState: async options => {
        calls.push(['agentBrowser', options]);
        return { isPanerelayDefault: false, providerAvailable: false };
      },
    },
  );
  assert.deepEqual(calls, [
    ['agentBrowser', { homeDirectory: '/tmp/panerelay-state-home' }],
    [
      'registration',
      'browser-use',
      {
        dataDirectory: '/tmp/panerelay-state-data',
        environment: { HOME: '/tmp/ignored-home' },
        homeDirectory: '/tmp/panerelay-state-home',
        platform: 'linux',
      },
    ],
    [
      'registration',
      'playwright',
      {
        dataDirectory: '/tmp/panerelay-state-data',
        environment: { HOME: '/tmp/ignored-home' },
        homeDirectory: '/tmp/panerelay-state-home',
        platform: 'linux',
      },
    ],
    [
      'mode',
      'browser-use',
      { environment: { HOME: '/tmp/ignored-home' }, homeDirectory: '/tmp/panerelay-state-home' },
    ],
  ]);
});
