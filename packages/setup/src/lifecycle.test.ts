import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeHostInstallationResult } from '@panerelay/bridge/install';
import { setupPanerelay, uninstallPanerelay } from './lifecycle.js';

const host: NativeHostInstallationResult = {
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
  let browserUseDefault: 'direct' | 'extension' | undefined;
  const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
  const result = await setupPanerelay(
    {
      agentBrowser: true,
      environment: { PANERELAY_EXTENSION_ID: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      browserUse: true,
      extensionId,
      globalDefault: true,
      homeDirectory: '/home',
      project: true,
      projectDirectory: '/project',
    },
    {
      probeAgentBrowser: async () => {
        calls.push('probe-agent-browser');
        return { executable: '/bin/agent-browser', supported: true, version: '0.33.0' };
      },
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
      installBrowserUse: async options => {
        calls.push('install-browser-use');
        browserUseDefault = options?.browserUseDefault;
        return {
          config: {
            adapterId: 'browser-use',
            adapterLauncherPath: '/home/.panerelay/adapter',
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
            dataDirectory: '/home/.panerelay',
            integrationConfigPath: '/home/.panerelay/browser-use/config.json',
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
      installBrowserUseSkill: async options => {
        calls.push('install-browser-use-skill');
        assert.equal(options.setupVersion, '0.2.0');
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
    'probe-agent-browser',
    'install-host',
    'register-provider',
    'configure-global',
    'install-skill:global',
    'install-browser-use',
    'install-browser-use-skill',
    'configure-project',
    'install-skill:project',
  ]);
  assert.equal(result.globalDefault, true);
  assert.equal(browserUseDefault, 'extension');
  assert.equal(result.browserUseRequested, true);
  assert.equal(result.browserUseReady, true);
  assert.equal(result.projectConfigPath, '/project/agent-browser.json');
});

test('base setup installs only the Native Host and skips both engine integrations', async () => {
  const calls: string[] = [];
  const result = await setupPanerelay(
    { homeDirectory: '/home' },
    {
      installHost: async options => {
        calls.push('install-host');
        assert.ok(options);
        return host;
      },
      installBrowserUse: async () => {
        calls.push('install-browser-use');
        throw new Error('Browser Use should not be installed');
      },
      installSkill: async () => {
        calls.push('install-agent-browser-skill');
        throw new Error('agent-browser Skill should not be installed');
      },
      registerProvider: async () => {
        calls.push('register-agent-browser-provider');
        throw new Error('agent-browser Provider should not be registered');
      },
    },
  );

  assert.deepEqual(calls, ['install-host']);
  assert.equal(result.agentBrowserInstallation, undefined);
  assert.equal(result.agentBrowserConfigPath, undefined);
  assert.equal(result.globalSkillPath, undefined);
  assert.equal(result.browserUseIntegration, undefined);
});

test('Playwright setup installs only Panerelay-owned adapter and additive Skill artifacts', async () => {
  const calls: string[] = [];
  const result = await setupPanerelay(
    { homeDirectory: '/home', playwright: true },
    {
      installHost: async () => {
        calls.push('install-host');
        return host;
      },
      probePlaywright: async () => {
        calls.push('probe-playwright');
        return { executable: '/bin/playwright-cli', supported: true, version: '0.1.17' };
      },
      installPlaywright: async options => {
        calls.push('install-playwright');
        assert.equal(options?.playwrightInstallation?.executable, '/bin/playwright-cli');
        return {
          paths: {
            adapterArtifactPath: '/home/.panerelay/adapters/playwright/adapter.mjs',
            adapterLauncherPath: '/home/.panerelay/bin/panerelay-playwright-adapter',
            adapterPackagePath: '/home/.panerelay/adapters/playwright/package.json',
            adapterStorageDirectory: '/home/.panerelay/adapters/playwright',
            configPath: '/home/.panerelay/playwright/config.json',
            dataDirectory: '/home/.panerelay',
          },
          registration: {
            adapterId: 'playwright',
            version: '0.4.0',
            executablePath: '/home/.panerelay/bin/panerelay-playwright-adapter',
            protocol: 'panerelay.cli-adapter.v1',
            capabilities: ['connection.resolve', 'adapter.doctor'],
            modes: ['direct', 'extension'],
            childEnvironmentKeys: ['PLAYWRIGHT_MCP_CDP_ENDPOINT'],
          },
          registry: { protocol: 'panerelay.cli-adapter-registry.v1', adapters: [] },
        };
      },
      installPlaywrightSkill: async options => {
        calls.push('install-playwright-skill');
        assert.equal(options.setupVersion, '0.4.0');
        return '/home/.agents/skills/panerelay-playwright';
      },
    },
  );

  assert.deepEqual(calls, [
    'install-host',
    'probe-playwright',
    'install-playwright',
    'install-playwright-skill',
  ]);
  assert.equal(result.playwrightInstallation?.version, '0.1.17');
  assert.equal(result.playwrightSkillPath, '/home/.agents/skills/panerelay-playwright');
});

test('rejects Provider scopes before installing the Native Host without agent-browser', async () => {
  for (const scope of [{ globalDefault: true }, { project: true }]) {
    let writes = 0;
    await assert.rejects(
      setupPanerelay(scope, {
        installHost: async () => {
          writes += 1;
          return host;
        },
      }),
      /requires? agentBrowser|requires agentBrowser or browserUse/,
    );
    assert.equal(writes, 0);
  }
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
          gatewayStop: 'absent',
          paths: {
            adapterArtifactPath: '/home/.panerelay/adapter.mjs',
            adapterLauncherPath: '/home/.panerelay/adapter',
            adapterPackagePath: '/home/.panerelay/package.json',
            adapterStorageDirectory: '/home/.panerelay/adapters/browser-use',
            browserUseDirectory: '/home/.panerelay/browser-use',
            dataDirectory: '/home/.panerelay',
            integrationConfigPath: '/home/.panerelay/browser-use/config.json',
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
      uninstallPlaywright: async () => {
        calls.push('uninstall-playwright');
        return {
          paths: {
            adapterArtifactPath: '/home/.panerelay/adapters/playwright/adapter.mjs',
            adapterLauncherPath: '/home/.panerelay/bin/panerelay-playwright-adapter',
            adapterPackagePath: '/home/.panerelay/adapters/playwright/package.json',
            adapterStorageDirectory: '/home/.panerelay/adapters/playwright',
            configPath: '/home/.panerelay/playwright/config.json',
            dataDirectory: '/home/.panerelay',
          },
          registry: { protocol: 'panerelay.cli-adapter-registry.v1', adapters: [] },
        };
      },
      uninstallPlaywrightSkill: async () => {
        calls.push('uninstall-playwright-skill');
        return '/home/.agents/skills/panerelay-playwright';
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
    'uninstall-playwright',
    'uninstall-playwright-skill',
    'uninstall-browser-use-skill',
    'remove-project',
    'uninstall-skill:project',
  ]);
});
