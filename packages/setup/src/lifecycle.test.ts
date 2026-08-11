import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeHostInstallationResult } from '@panerelay/bridge/install';
import { setupPanerelay, uninstallPanerelay } from './lifecycle.js';

const host: NativeHostInstallationResult = {
  codexPath: '/bin/codex',
  currentVersionPath: '/home/.panerelay/host-current.json',
  extensionId: 'extension-test',
  hostPath: '/home/.panerelay/bin/panerelay-native-host.cjs',
  hostsDirectory: '/home/.panerelay/hosts',
  launchPath: '/home/.panerelay/bin/panerelay-native-host.cjs',
  legacyHostPath: '/home/.panerelay/bin/panerelay-native-host.mjs',
  manifestPaths: ['/home/native-manifest.json'],
  releaseVersion: '0.7.0',
  runtimeConfigPath: '/home/.panerelay/runtime.json',
  selectedHostPath: '/home/.panerelay/hosts/0.7.0/native-host.bundle.cjs',
  updateLockPath: '/home/.panerelay/update.lock',
};

test('installs the exact CLI before Host setup when explicitly enabled', async () => {
  const calls: string[] = [];
  const result = await setupPanerelay(
    {
      cliVersion: '0.9.0',
      environment: { HOME: '/home' },
      homeDirectory: '/home',
      installCli: true,
    },
    {
      installGlobalCli: async (version, options) => {
        calls.push(`install-cli:${version}`);
        assert.equal(options?.homeDirectory, '/home');
        return {
          managed: true,
          operation: 'installed',
          packageSpec: `@panerelay/cli@${version}`,
          version,
        };
      },
      installHost: async () => {
        calls.push('install-host');
        return host;
      },
    },
  );

  assert.deepEqual(calls, ['install-cli:0.9.0', 'install-host']);
  assert.equal(result.cli?.version, '0.9.0');
});

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
      probeBrowserUse: async () => ({
        browserHarness: '0.1.9',
        browserUse: '0.13.8',
        browserUseExecutable: '/bin/browser-use',
      }),
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
    'install-browser-use',
    'configure-project',
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
      registerProvider: async () => {
        calls.push('register-agent-browser-provider');
        throw new Error('agent-browser Provider should not be registered');
      },
    },
  );

  assert.deepEqual(calls, ['install-host']);
  assert.equal(result.agentBrowserInstallation, undefined);
  assert.equal(result.agentBrowserConfigPath, undefined);
  assert.equal(result.browserUseIntegration, undefined);
});

test('explicit Agent fetch setup uses the stable Native Host launcher', async () => {
  const calls: string[] = [];
  const result = await setupPanerelay(
    { codexFetch: true, claudeFetch: true, homeDirectory: '/home' },
    {
      installHost: async () => host,
      installCodexFetch: async (launchPath, options) => {
        calls.push(`codex:${launchPath}:${options?.homeDirectory}`);
        return '/home/.codex/config.toml';
      },
      installClaudeFetch: async (launchPath, options) => {
        calls.push(`claude:${launchPath}:${options?.homeDirectory}`);
        return {
          configPath: '/home/.claude.json',
          settingsPath: '/home/.claude/settings.json',
        };
      },
    },
  );
  assert.deepEqual(calls, [`codex:${host.launchPath}:/home`, `claude:${host.launchPath}:/home`]);
  assert.equal(result.codexFetchConfigPath, '/home/.codex/config.toml');
  assert.equal(result.claudeFetchConfigPaths?.settingsPath, '/home/.claude/settings.json');
});

test('explicit Agent fetch removal keeps the Native Host and removes only selected routing', async () => {
  const calls: string[] = [];
  const result = await setupPanerelay(
    { removeCodexFetch: true, removeClaudeFetch: true, homeDirectory: '/home' },
    {
      installHost: async () => {
        calls.push('install-host');
        return host;
      },
      uninstallCodexFetch: async options => {
        calls.push(`remove-codex:${options?.homeDirectory}`);
        return '/home/.codex/config.toml';
      },
      uninstallClaudeFetch: async options => {
        calls.push(`remove-claude:${options?.homeDirectory}`);
        return {
          configPath: '/home/.claude.json',
          settingsPath: '/home/.claude/settings.json',
        };
      },
    },
  );
  assert.deepEqual(calls, ['install-host', 'remove-codex:/home', 'remove-claude:/home']);
  assert.equal(result.removedCodexFetchConfigPath, '/home/.codex/config.toml');
  assert.equal(result.removedClaudeFetchConfigPaths?.settingsPath, '/home/.claude/settings.json');
});

test('Playwright setup installs only Panerelay-owned adapter artifacts', async () => {
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
    },
  );

  assert.deepEqual(calls, ['install-host', 'probe-playwright', 'install-playwright']);
  assert.equal(result.playwrightInstallation?.version, '0.1.17');
});

test('Playwright setup reports unavailable installations without writing integration artifacts', async () => {
  for (const installation of [
    { executable: '/bin/playwright-cli', supported: false, version: '0.1.16' },
    { supported: true, version: '0.1.17' },
  ]) {
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
          return installation;
        },
        installPlaywright: async () => {
          calls.push('install-playwright');
          throw new Error('Playwright integration must not be installed');
        },
      },
    );

    assert.deepEqual(calls, ['install-host', 'probe-playwright']);
    assert.deepEqual(result.playwrightInstallation, installation);
    assert.equal(result.playwrightIntegration, undefined);
  }
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
      unregisterProvider: async () => {
        calls.push('unregister-provider');
        return '/home/.agent-browser/config.json';
      },
    },
  );

  assert.deepEqual(calls, [
    'uninstall-host',
    'unregister-provider',
    'uninstall-browser-use',
    'uninstall-playwright',
    'remove-project',
  ]);
});

test('interactive empty selection removes every optional Panerelay integration but keeps the host', async () => {
  const calls: string[] = [];
  const result = await setupPanerelay(
    { homeDirectory: '/home', reconcileIntegrations: true },
    {
      installHost: async () => {
        calls.push('install-host');
        return host;
      },
      unregisterProvider: async () => {
        calls.push('unregister-provider');
        return '/home/.agent-browser/config.json';
      },
      uninstallBrowserUse: async () => {
        calls.push('uninstall-browser-use');
        return { detachedDaemonMayRemain: true } as never;
      },
      uninstallPlaywright: async () => {
        calls.push('uninstall-playwright');
        return { registry: { adapters: [] } } as never;
      },
    },
  );

  assert.deepEqual(calls, [
    'install-host',
    'unregister-provider',
    'uninstall-browser-use',
    'uninstall-playwright',
  ]);
  assert.equal(result.host, host);
  assert.equal(result.removedAgentBrowserConfigPath, '/home/.agent-browser/config.json');
  assert.equal(result.removedBrowserUseIntegration?.detachedDaemonMayRemain, true);
  assert.ok(result.removedPlaywrightIntegration);
});

test('interactive partial selection installs checked and removes unchecked integrations sequentially', async () => {
  const calls: string[] = [];
  let browserUseDefault: 'direct' | 'extension' | undefined;
  await setupPanerelay(
    {
      browserUse: true,
      globalDefault: false,
      homeDirectory: '/home',
      reconcileIntegrations: true,
    },
    {
      installHost: async () => {
        calls.push('install-host');
        return host;
      },
      installBrowserUse: async options => {
        calls.push('install-browser-use');
        browserUseDefault = options?.browserUseDefault;
        return {} as never;
      },
      probeBrowserUse: async () => {
        calls.push('probe-browser-use');
        return {
          browserHarness: '0.1.8',
          browserUse: '0.13.7',
          browserUseExecutable: '/bin/browser-use',
        };
      },
      unregisterProvider: async () => {
        calls.push('unregister-provider');
        return '/home/.agent-browser/config.json';
      },
      uninstallPlaywright: async () => {
        calls.push('uninstall-playwright');
        return {} as never;
      },
    },
  );

  assert.deepEqual(calls, [
    'install-host',
    'unregister-provider',
    'probe-browser-use',
    'install-browser-use',
    'uninstall-playwright',
  ]);
  assert.equal(browserUseDefault, 'direct');
});

test('interactive all-selected setup clears only Panerelay defaults when No is submitted', async () => {
  const calls: string[] = [];
  await setupPanerelay(
    {
      agentBrowser: true,
      browserUse: true,
      globalDefault: false,
      homeDirectory: '/home',
      playwright: true,
      reconcileIntegrations: true,
    },
    {
      clearGlobal: async () => {
        calls.push('clear-global');
        return '/home/.agent-browser/config.json';
      },
      installBrowserUse: async options => {
        calls.push(`install-browser-use:${options?.browserUseDefault}`);
        return {} as never;
      },
      installHost: async () => {
        calls.push('install-host');
        return host;
      },
      installPlaywright: async () => {
        calls.push('install-playwright');
        return {} as never;
      },
      probeAgentBrowser: async () => {
        calls.push('probe-agent-browser');
        return { executable: '/bin/agent-browser', supported: true, version: '0.33.0' };
      },
      probeBrowserUse: async () => {
        calls.push('probe-browser-use');
        return {
          browserHarness: '0.1.8',
          browserUse: '0.13.7',
          browserUseExecutable: '/bin/browser-use',
        };
      },
      probePlaywright: async () => {
        calls.push('probe-playwright');
        return { executable: '/bin/playwright-cli', supported: true, version: '0.1.17' };
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
    'clear-global',
    'probe-browser-use',
    'install-browser-use:direct',
    'probe-playwright',
    'install-playwright',
  ]);
});

test('explicit setup flags remain additive and do not remove or clear unmentioned integrations', async () => {
  const calls: string[] = [];
  await setupPanerelay(
    { agentBrowser: true, homeDirectory: '/home' },
    {
      clearGlobal: async () => {
        throw new Error('explicit setup must not clear a default');
      },
      installHost: async () => {
        calls.push('install-host');
        return host;
      },
      probeAgentBrowser: async () => ({
        executable: '/bin/agent-browser',
        supported: true,
        version: '0.33.0',
      }),
      registerProvider: async () => {
        calls.push('register-provider');
        return '/home/.agent-browser/config.json';
      },
      uninstallBrowserUse: async () => {
        throw new Error('explicit setup must not remove Browser Use');
      },
      uninstallPlaywright: async () => {
        throw new Error('explicit setup must not remove Playwright');
      },
    },
  );
  assert.deepEqual(calls, ['install-host', 'register-provider']);
});

test('interactive reconciliation stops after a thrown scoped removal', async () => {
  const calls: string[] = [];
  await assert.rejects(
    setupPanerelay(
      { homeDirectory: '/home', reconcileIntegrations: true },
      {
        installHost: async () => {
          calls.push('install-host');
          return host;
        },
        unregisterProvider: async () => {
          calls.push('unregister-provider');
          return '/home/.agent-browser/config.json';
        },
        uninstallBrowserUse: async () => {
          calls.push('uninstall-browser-use');
          throw new Error('browser-use removal failed');
        },
        uninstallPlaywright: async () => {
          calls.push('uninstall-playwright');
          return {} as never;
        },
      },
    ),
    /browser-use removal failed/,
  );
  assert.deepEqual(calls, ['install-host', 'unregister-provider', 'uninstall-browser-use']);
});
