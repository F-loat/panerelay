import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeHostInstallationResult } from '@panerelay/bridge/install';
import { setupPanerelay, uninstallPanerelay } from './lifecycle.js';

const host: NativeHostInstallationResult = {
  agentBrowserConfigPath: '/home/.panerelay/agent-browser.json',
  agentBrowserPath: '/bin/agent-browser',
  agentBrowserSupported: true,
  agentBrowserVersion: '0.33.0',
  codexPath: '/bin/codex',
  extensionId: 'extension-test',
  firefoxExtensionId: 'panerelay@f-loat.dev',
  firefoxAutomationReady: false,
  firefoxLauncherPath: '/home/.panerelay/bin/panerelay-firefox',
  firefoxRuntimeStatePath: '/home/.panerelay/firefox-runtime.json',
  hostPath: '/home/.panerelay/bin/panerelay-native-host.cjs',
  launchPath: '/home/.panerelay/bin/panerelay-native-host.cjs',
  legacyHostPath: '/home/.panerelay/bin/panerelay-native-host.mjs',
  legacyManifestPaths: [],
  chromiumManifestPaths: ['/home/chromium-manifest.json'],
  firefoxManifestPaths: ['/home/firefox-manifest.json'],
  manifestPaths: ['/home/native-manifest.json'],
  runtimeConfigPath: '/home/.panerelay/runtime.json',
};

test('setup can opt into global and project default providers', async () => {
  const calls: string[] = [];
  const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
  const firefoxExtensionId = 'custom-panerelay@example.com';
  const result = await setupPanerelay(
    {
      environment: { PANERELAY_EXTENSION_ID: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      extensionId,
      firefoxExtensionId,
      globalProvider: true,
      homeDirectory: '/home',
      project: true,
      projectDirectory: '/project',
    },
    {
      configureGlobal: async () => {
        calls.push('configure-global');
        return '/home/.agent-browser/config.json';
      },
      configureProject: async () => {
        calls.push('configure-project');
        return '/project/agent-browser.json';
      },
      installHost: async options => {
        calls.push('install-host');
        assert.ok(options);
        assert.equal(options.extensionId, extensionId);
        assert.equal(options.firefoxExtensionId, firefoxExtensionId);
        assert.equal(
          options.environment?.PANERELAY_EXTENSION_ID,
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        );
        return host;
      },
      installSkill: async scope => {
        calls.push(`install-skill:${scope}`);
        return `/${scope}/skill`;
      },
      registerProvider: async () => {
        calls.push('register-provider');
        return '/home/.agent-browser/config.json';
      },
    },
  );

  assert.deepEqual(calls, [
    'install-host',
    'register-provider',
    'configure-global',
    'install-skill:global',
    'configure-project',
    'install-skill:project',
  ]);
  assert.equal(result.globalProvider, true);
  assert.equal(result.projectConfigPath, '/project/agent-browser.json');
});

test('uninstall removes only Panerelay-owned integration through scoped operations', async () => {
  const calls: string[] = [];
  await uninstallPanerelay(
    { homeDirectory: '/home', project: true, projectDirectory: '/project' },
    {
      removeProject: async () => {
        calls.push('remove-project');
        return '/project/agent-browser.json';
      },
      uninstallHost: async () => {
        calls.push('uninstall-host');
        return host;
      },
      uninstallSkill: async scope => {
        calls.push(`uninstall-skill:${scope}`);
        return `/${scope}/skill`;
      },
      unregisterProvider: async () => {
        calls.push('unregister-provider');
        return '/home/.agent-browser/config.json';
      },
    },
  );

  assert.deepEqual(calls, [
    'uninstall-host',
    'unregister-provider',
    'uninstall-skill:global',
    'remove-project',
    'uninstall-skill:project',
  ]);
});
