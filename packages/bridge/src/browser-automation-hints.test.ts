import assert from 'node:assert/strict';
import test from 'node:test';
import { PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION } from '@panerelay/protocol';
import {
  PANERELAY_CLI_ADAPTER_PREFERENCES_VERSION,
  PANERELAY_CLI_ADAPTER_REGISTRY_VERSION,
  type CliAdapterRegistration,
} from '@panerelay/cli/adapter-config';
import { readBrowserAutomationSetupHint } from './browser-automation-hints.js';

function adapter(adapterId: string): CliAdapterRegistration {
  return {
    adapterId,
    version: '1.0.0',
    executablePath: `/protected/${adapterId}`,
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    capabilities: [],
    modes: [],
    childEnvironmentKeys: [],
  };
}

test('summarizes registered integrations without paths or adapter versions', async () => {
  const hint = await readBrowserAutomationSetupHint({
    readAgentBrowserState: async () => ({
      providerAvailable: true,
      isPanerelayDefault: true,
    }),
    readAdapterRegistry: async () => ({
      protocol: PANERELAY_CLI_ADAPTER_REGISTRY_VERSION,
      adapters: [adapter('browser-use'), adapter('playwright')],
    }),
    readAdapterPreferences: async () => ({
      protocol: PANERELAY_CLI_ADAPTER_PREFERENCES_VERSION,
      modes: { 'browser-use': 'extension' },
    }),
  });

  assert.deepEqual(hint, {
    agentBrowser: { registered: true, isDefault: true },
    browserUse: { registered: true, mode: 'extension' },
    playwright: { registered: true },
  });
  assert.doesNotMatch(JSON.stringify(hint), /protected|1\.0\.0/);
});

test('keeps readable registrations when another setup surface is invalid', async () => {
  const hint = await readBrowserAutomationSetupHint({
    readAgentBrowserState: async () => {
      throw new Error('invalid agent-browser config');
    },
    readAdapterRegistry: async () => ({
      protocol: PANERELAY_CLI_ADAPTER_REGISTRY_VERSION,
      adapters: [adapter('playwright')],
    }),
    readAdapterPreferences: async () => {
      throw new Error('invalid preferences');
    },
  });

  assert.deepEqual(hint, { playwright: { registered: true } });
});

test('omits the hint when no Panerelay browser integration is registered', async () => {
  const hint = await readBrowserAutomationSetupHint({
    readAgentBrowserState: async () => ({
      providerAvailable: false,
      isPanerelayDefault: false,
    }),
    readAdapterRegistry: async () => ({
      protocol: PANERELAY_CLI_ADAPTER_REGISTRY_VERSION,
      adapters: [],
    }),
    readAdapterPreferences: async () => ({
      protocol: PANERELAY_CLI_ADAPTER_PREFERENCES_VERSION,
      modes: {},
    }),
  });

  assert.equal(hint, undefined);
});
