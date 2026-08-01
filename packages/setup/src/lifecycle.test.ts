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
  hostPath: '/home/.panerelay/bin/panerelay-native-host.cjs',
  launchPath: '/home/.panerelay/bin/panerelay-native-host.cjs',
  legacyHostPath: '/home/.panerelay/bin/panerelay-native-host.mjs',
  manifestPaths: ['/home/native-manifest.json'],
  runtimeConfigPath: '/home/.panerelay/runtime.json',
};

test('setup can opt into global and project default providers', async () => {
  const calls: string[] = [];
  const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
  const result = await setupPanerelay(
    {
      environment: { PANERELAY_EXTENSION_ID: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      browserUse: true,
      extensionId,
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
        assert.equal(
          options.environment?.PANERELAY_EXTENSION_ID,
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        );
        return host;
      },
      installBrowserUse: async () => {
        calls.push('install-browser-use');
        return {
          config: {
            adapterId: 'browser-use',
            adapterLauncherPath: '/home/.panerelay/adapter',
            cliLauncherPath: '/home/.panerelay/cli',
            protocol: 'panerelay.browser-use-integration.v1',
            runtimeDirectory: '/home/.panerelay/browser-use/runtime',
            runtimeName: 'panerelay',
            version: '0.2.0',
          },
          paths: {
            adapterArtifactPath: '/home/.panerelay/adapter.mjs',
            adapterLauncherPath: '/home/.panerelay/adapter',
            adapterPackagePath: '/home/.panerelay/package.json',
            adapterStorageDirectory: '/home/.panerelay/adapters/browser-use',
            browserUseDirectory: '/home/.panerelay/browser-use',
            cliArtifactPath: '/home/.panerelay/cli.mjs',
            cliLauncherPath: '/home/.panerelay/cli',
            cliStorageDirectory: '/home/.panerelay/cli/browser-use',
            dataDirectory: '/home/.panerelay',
            integrationConfigPath: '/home/.panerelay/browser-use/config.json',
            mcpLauncherPath: '/home/.panerelay/bin/panerelay-browser-use-mcp',
            mcpRunnerArtifactPath: '/home/.panerelay/cli/0.2.0/dist/mcp-runner.mjs',
            runtimeDirectory: '/home/.panerelay/browser-use/runtime',
          },
          registration: {
            adapterId: 'browser-use',
            version: '0.2.0',
            executablePath: '/home/.panerelay/adapter',
            protocol: 'panerelay.cli-adapter.v1',
            capabilities: ['connection.resolve', 'adapter.doctor'],
            modes: ['direct', 'extension'],
            childEnvironmentKeys: [],
          },
          registry: {
            protocol: 'panerelay.cli-adapter-registry.v1',
            adapters: [],
          },
        };
      },
      installBrowserUseSkill: async cliLauncherPath => {
        calls.push('install-browser-use-skill');
        assert.equal(cliLauncherPath, '/home/.panerelay/cli');
        return '/home/.agents/skills/panerelay-browser-use';
      },
      probeBrowserUse: async () => ({
        browserHarness: '0.1.9',
        browserUse: '0.13.8',
        browserUseExecutable: '/bin/browser-use',
      }),
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
    'install-browser-use',
    'install-browser-use-skill',
    'configure-project',
    'install-skill:project',
  ]);
  assert.equal(result.globalProvider, true);
  assert.equal(result.browserUseRequested, true);
  assert.equal(result.browserUseReady, true);
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
      uninstallBrowserUse: async () => {
        calls.push('uninstall-browser-use');
        return {
          detachedDaemonMayRemain: false,
          paths: {
            adapterArtifactPath: '/home/.panerelay/adapter.mjs',
            adapterLauncherPath: '/home/.panerelay/adapter',
            adapterPackagePath: '/home/.panerelay/package.json',
            adapterStorageDirectory: '/home/.panerelay/adapters/browser-use',
            browserUseDirectory: '/home/.panerelay/browser-use',
            cliArtifactPath: '/home/.panerelay/cli.mjs',
            cliLauncherPath: '/home/.panerelay/cli',
            cliStorageDirectory: '/home/.panerelay/cli/browser-use',
            dataDirectory: '/home/.panerelay',
            integrationConfigPath: '/home/.panerelay/browser-use/config.json',
            mcpLauncherPath: '/home/.panerelay/bin/panerelay-browser-use-mcp',
            mcpRunnerArtifactPath: '/home/.panerelay/cli/browser-use/0.2.0/mcp-runner.mjs',
            runtimeDirectory: '/home/.panerelay/browser-use/runtime',
          },
          registry: {
            protocol: 'panerelay.cli-adapter-registry.v1',
            adapters: [],
          },
          runtimeStateRemoved: false,
        };
      },
      uninstallBrowserUseSkill: async () => {
        calls.push('uninstall-browser-use-skill');
        return '/home/.agents/skills/panerelay-browser-use';
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
    'uninstall-browser-use',
    'uninstall-browser-use-skill',
    'remove-project',
    'uninstall-skill:project',
  ]);
});
