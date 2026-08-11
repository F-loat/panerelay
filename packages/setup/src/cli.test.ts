import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PANERELAY_EXTENSION_ID } from '@panerelay/protocol';
import { main, parseSetupArgs } from './cli.js';
import {
  installBrowserUseIntegrationArtifacts,
  type BrowserUseIntegrationInstallation,
} from './browser-use-integration.js';
import { configureGlobalProvider, registerPanerelayProvider } from './config.js';
import type { DoctorReport } from './doctor.js';
import { readInteractiveSetupState } from './interactive-setup-state.js';
import { setupPanerelay } from './lifecycle.js';
import { installPlaywrightIntegration } from './playwright-integration.js';

const chromeWebStoreUrl =
  'https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi';
const versionedHostFixture = {
  currentVersionPath: '/tmp/host-current.json',
  hostsDirectory: '/tmp/hosts',
  releaseVersion: '0.7.0',
  selectedHostPath: '/tmp/hosts/0.7.0/native-host.bundle.cjs',
  updateLockPath: '/tmp/update.lock',
};

test('parses setup aliases and global default flags', () => {
  assert.deepEqual(parseSetupArgs([]), {
    agentBrowser: false,
    browserUse: false,
    playwright: false,
    globalDefault: false,
    help: false,
    json: false,
    language: undefined,
    operation: 'setup',
    yes: false,
  });
  assert.deepEqual(
    parseSetupArgs(['install', '--agent-browser', '--browser-use', '--global-default']),
    {
      agentBrowser: true,
      browserUse: true,
      playwright: false,
      globalDefault: true,
      help: false,
      json: false,
      language: undefined,
      operation: 'setup',
      yes: false,
    },
  );
  assert.deepEqual(parseSetupArgs(['doctor', '--agent-browser', '--global-default', '--json']), {
    agentBrowser: true,
    browserUse: false,
    playwright: false,
    globalDefault: true,
    help: false,
    json: true,
    language: undefined,
    operation: 'doctor',
    yes: false,
  });
  assert.throws(
    () => parseSetupArgs(['--global-default']),
    /--global-default requires --agent-browser or --browser-use/,
  );
  assert.throws(
    () => parseSetupArgs(['doctor', '--project-provider']),
    /Unknown option: --project-provider/,
  );
  assert.throws(
    () => parseSetupArgs(['uninstall', '--global-default']),
    /--global-default is not needed/,
  );
  assert.equal(parseSetupArgs(['setup', '--browser-use']).browserUse, true);
  assert.equal(parseSetupArgs(['setup', '--browser-use', '--global-default']).globalDefault, true);
  assert.equal(parseSetupArgs(['setup', '--agent-browser']).agentBrowser, true);
  assert.equal(parseSetupArgs(['update', '--no-cli']).skipCli, true);
  assert.equal(parseSetupArgs(['uninstall', '--keep-cli']).keepCli, true);
  assert.throws(() => parseSetupArgs(['add', 'bilibili', '--no-cli']), /Unknown option/);
  assert.throws(() => parseSetupArgs(['doctor', '--no-cli']), /only available with setup/);
  assert.equal(parseSetupArgs(['doctor', '--browser-use']).browserUse, true);
  assert.equal(parseSetupArgs(['doctor', '--playwright']).playwright, true);
  assert.equal(parseSetupArgs(['setup', '--codex-fetch']).codexFetch, true);
  assert.equal(parseSetupArgs(['doctor', '--claude-fetch']).claudeFetch, true);
  assert.equal(parseSetupArgs(['setup', '--remove-codex-fetch']).removeCodexFetch, true);
  assert.equal(parseSetupArgs(['setup', '--remove-claude-fetch']).removeClaudeFetch, true);
  assert.throws(
    () => parseSetupArgs(['setup', '--codex-fetch', '--remove-codex-fetch']),
    /cannot be combined/,
  );
  assert.throws(
    () => parseSetupArgs(['doctor', '--remove-claude-fetch']),
    /only available with setup/,
  );
  const playwrightSetup = parseSetupArgs(['setup', '--playwright']);
  assert.equal(playwrightSetup.playwright, true);
  assert.equal(playwrightSetup.globalDefault, false);
  assert.throws(
    () => parseSetupArgs(['uninstall', '--browser-use']),
    /--browser-use is not needed/,
  );
  assert.throws(() => parseSetupArgs(['uninstall', '--playwright']), /--playwright is not needed/);
  assert.throws(
    () => parseSetupArgs(['uninstall', '--agent-browser']),
    /--agent-browser is not needed/,
  );
  assert.throws(() => parseSetupArgs(['uninstall', '--codex-fetch']), /not needed with uninstall/);
});

test('parses fetch adapter add, batch remove, all, and list commands', () => {
  assert.deepEqual(parseSetupArgs(['add', 'bilibili', '/tmp/local-adapter']), {
    agentBrowser: false,
    browserUse: false,
    playwright: false,
    globalDefault: false,
    help: false,
    json: false,
    language: undefined,
    operation: 'add',
    yes: false,
    adapterItems: ['bilibili', '/tmp/local-adapter'],
  });
  assert.deepEqual(parseSetupArgs(['remove', '--all']), {
    agentBrowser: false,
    browserUse: false,
    playwright: false,
    globalDefault: false,
    help: false,
    json: false,
    language: undefined,
    operation: 'remove',
    yes: false,
    adapterAll: true,
  });
  assert.deepEqual(parseSetupArgs(['add', '--all']), {
    agentBrowser: false,
    browserUse: false,
    playwright: false,
    globalDefault: false,
    help: false,
    json: false,
    language: undefined,
    operation: 'add',
    yes: false,
    adapterAll: true,
  });
  assert.equal(parseSetupArgs(['adapters']).operation, 'adapters');
  assert.throws(() => parseSetupArgs(['add']), /requires at least one adapter/);
  assert.throws(() => parseSetupArgs(['remove', '--all', 'bilibili']), /cannot be combined/);
});

test('runs fetch adapter lifecycle commands without invoking base setup', async () => {
  const output: string[] = [];
  const installCalls: string[][] = [];
  const originalLog = console.log;
  let setupCalls = 0;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const manifest = {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      id: 'bilibili',
      name: 'Bilibili',
      version: '0.8.0',
      description: 'Bilibili commands.',
      origins: ['https://api.bilibili.com'],
      entry: 'adapter.mjs',
      commands: [
        {
          name: 'me',
          description: 'Profile.',
          access: 'read' as const,
          args: [],
          output: ['uid'],
          examples: ['panerelay bilibili me'],
        },
      ],
    };
    const registration = {
      manifest,
      executablePath: '/tmp/adapter.mjs',
      sha256: 'a'.repeat(64),
      source: {
        kind: 'github' as const,
        repository: 'owner/repository',
        commit: '0123456789abcdef0123456789abcdef01234567',
      },
    };
    const dependencies = {
      environment: {},
      setup: async () => {
        setupCalls += 1;
        throw new Error('base setup must not run');
      },
      installFetchAdapters: async (sources: string[]) => {
        installCalls.push(sources);
        return [registration];
      },
      listFetchAdapters: async () => [registration],
      removeFetchAdapters: async () => ['bilibili'],
    };
    assert.equal(await main(['add', 'bilibili', '--lang', 'en'], dependencies), 0);
    assert.equal(await main(['add', '--all', '--lang', 'en'], dependencies), 0);
    assert.equal(await main(['adapters', '--lang', 'en'], dependencies), 0);
    assert.equal(await main(['remove', 'bilibili', '--lang', 'zh-CN'], dependencies), 0);
    assert.equal(setupCalls, 0);
    assert.deepEqual(installCalls, [['bilibili'], ['all']]);
    assert.match(output.join('\n'), /Installed fetch adapters\n {2}bilibili@0\.8\.0/);
    assert.match(output.join('\n'), /GitHub owner\/repository at 0123456789ab/);
    assert.match(output.join('\n'), /已移除 Fetch 适配器：bilibili/);
  } finally {
    console.log = originalLog;
  }
});

test('localizes source and GitHub help, trust guidance, and adapter failures', async () => {
  const output: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  console.error = (...values: unknown[]) => errors.push(values.join(' '));
  try {
    assert.equal(await main(['add', '--help', '--lang', 'en'], { environment: {} }), 0);
    assert.match(output.join('\n'), /owner\/repository/);
    assert.match(output.join('\n'), /local two-file\/source-form/);
    assert.match(output.join('\n'), /@panerelay\/setup add --all/);
    output.length = 0;
    assert.equal(await main(['add', '--help', '--lang', 'zh-CN'], { environment: {} }), 0);
    assert.match(output.join('\n'), /公开 GitHub/);
    assert.match(output.join('\n'), /源码格式/);
    assert.match(output.join('\n'), /@panerelay\/setup add --all/);
    output.length = 0;
    assert.equal(
      await main(['add', 'unknown', '--lang', 'zh-CN'], {
        environment: {},
        installFetchAdapters: async () => {
          throw new Error('Unknown fetch adapter source: unknown');
        },
      }),
      1,
    );
    assert.match(output.join('\n'), /第三方代码/);
    assert.match(errors.join('\n'), /未知 Fetch 适配器来源： unknown/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test('localizes the Playwright uninstall option error', async () => {
  const errors: string[] = [];
  const originalError = console.error;
  const originalLog = console.log;
  console.error = (...values: unknown[]) => errors.push(values.join(' '));
  console.log = () => undefined;
  try {
    assert.equal(
      await main(['uninstall', '--playwright', '--lang', 'en'], {
        environment: {},
        systemLocale: 'zh-CN',
      }),
      2,
    );
    assert.match(errors.join('\n'), /--playwright is not needed with uninstall/);
    assert.doesNotMatch(errors.join('\n'), /[卸载无需]/);
    errors.length = 0;
    assert.equal(
      await main(['uninstall', '--playwright', '--lang', 'zh-CN'], {
        environment: {},
        systemLocale: 'en',
      }),
      2,
    );
    assert.match(errors.join('\n'), /uninstall 无需使用 --playwright/);
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }
});

test('passes independent engine selections without changing the base setup call', async () => {
  const selections: Array<{ agentBrowser: boolean; browserUse: boolean }> = [];
  const setup = async (options?: { agentBrowser?: boolean; browserUse?: boolean }) => {
    selections.push({
      agentBrowser: options?.agentBrowser === true,
      browserUse: options?.browserUse === true,
    });
    return {
      ...(options?.agentBrowser
        ? {
            agentBrowserInstallation: {
              executable: '/tmp/agent-browser',
              supported: true,
              version: '0.33.0',
            },
            agentBrowserConfigPath: '/tmp/agent-browser.json',
          }
        : {}),
      ...(options?.browserUse ? { browserUseReady: true } : {}),
      globalDefault: false,
      host: {
        ...versionedHostFixture,
        extensionId: PANERELAY_EXTENSION_ID,
        hostPath: '/tmp/host.mjs',
        launchPath: '/tmp/host',
        legacyHostPath: '/tmp/legacy-host',
        manifestPaths: ['/tmp/manifest.json'],
        runtimeConfigPath: '/tmp/runtime.json',
      },
    };
  };
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    assert.equal(await main([], { environment: {}, setup, systemLocale: 'en' }), 0);
    assert.equal(
      await main(['--agent-browser'], { environment: {}, setup, systemLocale: 'en' }),
      0,
    );
    assert.equal(await main(['--browser-use'], { environment: {}, setup, systemLocale: 'en' }), 0);
    assert.equal(
      await main(['--agent-browser', '--browser-use'], {
        environment: {},
        setup,
        systemLocale: 'en',
      }),
      0,
    );
  } finally {
    console.log = originalLog;
  }
  assert.deepEqual(selections, [
    { agentBrowser: false, browserUse: false },
    { agentBrowser: true, browserUse: false },
    { agentBrowser: false, browserUse: true },
    { agentBrowser: true, browserUse: true },
  ]);
});

test('offers interactive integration and default selections only for the unflagged setup', async () => {
  const selections: Array<Record<string, unknown>> = [];
  const prompts: string[] = [];
  const confirmations: string[] = [];
  const progressEvents: string[] = [];
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    const code = await main([], {
      environment: {},
      interactive: () => true,
      createSetupProgress: () => ({
        error: message => progressEvents.push(`error:${message}`),
        start: message => progressEvents.push(`start:${message}`),
        stop: message => progressEvents.push(`stop:${message}`),
      }),
      readInteractiveState: async () => ({
        defaultIntegrations: ['agentBrowser', 'browserUse'],
        globalDefault: true,
        integrations: ['agentBrowser', 'browserUse', 'playwright'],
      }),
      selectIntegrations: async prompt => {
        prompts.push(prompt.message);
        assert.deepEqual(prompt.initialValues, ['agentBrowser', 'browserUse', 'playwright']);
        assert.deepEqual(
          prompt.options.map(option => option.value),
          ['agentBrowser', 'browserUse', 'playwright'],
        );
        assert.deepEqual(
          prompt.options.map(option => option.label),
          ['agent-browser', 'Browser Use', 'Playwright CLI'],
        );
        return ['agentBrowser', 'browserUse', 'playwright'];
      },
      confirmDefault: async prompt => {
        confirmations.push(prompt.message);
        assert.equal(prompt.active, 'Yes');
        assert.equal(prompt.inactive, 'No');
        assert.equal(prompt.initialValue, true);
        return true;
      },
      setup: async options => {
        selections.push({ ...options });
        return {
          agentBrowserInstallation: {
            executable: '/tmp/agent-browser',
            supported: true,
            version: '0.33.0',
          },
          browserUseReady: true,
          globalDefault: options?.globalDefault === true,
          host: {
            ...versionedHostFixture,
            extensionId: PANERELAY_EXTENSION_ID,
            hostPath: '/tmp/host.mjs',
            launchPath: '/tmp/host',
            legacyHostPath: '/tmp/legacy-host',
            manifestPaths: ['/tmp/manifest.json'],
            runtimeConfigPath: '/tmp/runtime.json',
          },
          playwrightInstallation: {
            executable: '/tmp/playwright-cli',
            supported: true,
            version: '0.1.17',
          },
        };
      },
      systemLocale: 'en',
    });
    assert.equal(code, 0);
    assert.equal(selections.length, 1);
    assert.equal(selections[0]?.agentBrowser, true);
    assert.equal(selections[0]?.browserUse, true);
    assert.equal(selections[0]?.playwright, true);
    assert.equal(selections[0]?.globalDefault, true);
    assert.equal(selections[0]?.browserUseDefault, 'extension');
    assert.equal(selections[0]?.reconcileIntegrations, true);

    await main(['--yes'], {
      environment: {},
      interactive: () => true,
      readInteractiveState: async () => {
        throw new Error('state should not be read');
      },
      selectIntegrations: async () => {
        throw new Error('prompt should not run');
      },
      setup: async options => {
        selections.push({ ...options });
        return {
          globalDefault: false,
          host: {
            ...versionedHostFixture,
            extensionId: PANERELAY_EXTENSION_ID,
            hostPath: '/tmp/host.mjs',
            launchPath: '/tmp/host',
            legacyHostPath: '/tmp/legacy-host',
            manifestPaths: ['/tmp/manifest.json'],
            runtimeConfigPath: '/tmp/runtime.json',
          },
        };
      },
      systemLocale: 'en',
    });
    assert.deepEqual(selections[1], {
      agentBrowser: false,
      browserUse: false,
      cliVersion: '0.9.0',
      playwright: false,
      environment: {},
      extensionId: undefined,
      globalDefault: false,
      installCli: true,
    });
    assert.equal(prompts.length, 1);
    assert.equal(
      prompts[0],
      'Select integrations (checked: install/update; unchecked: remove Panerelay integration)',
    );
    assert.equal(confirmations.length, 1);
    assert.match(confirmations[0]!, /user default/);
    assert.deepEqual(progressEvents, [
      'start:Applying Panerelay setup changes',
      'stop:Panerelay setup changes applied',
    ]);
  } finally {
    console.log = originalLog;
  }
});

test('ends interactive progress with localized failure feedback when setup throws', async () => {
  const progressEvents: string[] = [];
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...values: unknown[]) => errors.push(values.join(' '));
  try {
    assert.equal(
      await main(['--lang', 'zh-CN'], {
        createSetupProgress: () => ({
          error: message => progressEvents.push(`error:${message}`),
          start: message => progressEvents.push(`start:${message}`),
          stop: message => progressEvents.push(`stop:${message}`),
        }),
        environment: {},
        interactive: () => true,
        readInteractiveState: async () => ({
          defaultIntegrations: [],
          globalDefault: false,
          integrations: [],
        }),
        selectIntegrations: async () => [],
        setup: async () => {
          throw new Error('fixture setup failure');
        },
        systemLocale: 'en',
      }),
      1,
    );
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(progressEvents, [
    'start:正在应用 Panerelay 安装变更',
    'error:Panerelay 安装失败',
  ]);
  assert.deepEqual(errors, ['fixture setup failure']);
});

test('reads protected setup state again on each interactive run instead of caching selections', async () => {
  let currentState: {
    defaultIntegrations: Array<'agentBrowser' | 'browserUse'>;
    globalDefault: boolean;
    integrations: Array<'agentBrowser' | 'browserUse' | 'playwright'>;
  } = {
    defaultIntegrations: ['agentBrowser'],
    globalDefault: false,
    integrations: ['agentBrowser', 'browserUse'],
  };
  const initialValues: string[][] = [];
  const defaultValues: boolean[] = [];
  const reconciliations: Array<Record<string, unknown>> = [];
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    const run = async () =>
      main([], {
        confirmDefault: async prompt => {
          defaultValues.push(prompt.initialValue);
          return false;
        },
        environment: {},
        interactive: () => true,
        readInteractiveState: async () => ({
          defaultIntegrations: [...currentState.defaultIntegrations],
          globalDefault: currentState.globalDefault,
          integrations: [...currentState.integrations],
        }),
        selectIntegrations: async prompt => {
          initialValues.push([...prompt.initialValues]);
          return ['agentBrowser'];
        },
        setup: async options => {
          reconciliations.push({ ...options });
          currentState = {
            defaultIntegrations: [],
            globalDefault: false,
            integrations: ['agentBrowser'],
          };
          return {
            agentBrowserInstallation: {
              executable: '/tmp/agent-browser',
              supported: true,
              version: '0.33.0',
            },
            globalDefault: false,
            host: {
              ...versionedHostFixture,
              extensionId: PANERELAY_EXTENSION_ID,
              hostPath: '/tmp/host.mjs',
              launchPath: '/tmp/host',
              legacyHostPath: '/tmp/legacy-host',
              manifestPaths: ['/tmp/manifest.json'],
              runtimeConfigPath: '/tmp/runtime.json',
            },
          };
        },
        systemLocale: 'en',
      });

    assert.equal(await run(), 0);
    assert.equal(await run(), 0);
  } finally {
    console.log = originalLog;
  }
  assert.deepEqual(initialValues, [['agentBrowser', 'browserUse'], ['agentBrowser']]);
  assert.deepEqual(defaultValues, [true, false]);
  assert.equal(reconciliations[0]?.browserUse, false);
  assert.equal(reconciliations[0]?.reconcileIntegrations, true);
  assert.equal(reconciliations[1]?.reconcileIntegrations, true);
});

test('reconciles an isolated interactive selection while preserving upstream executables', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'panerelay-interactive-reconcile-'));
  const homeDirectory = join(fixture, 'home');
  const environment = { HOME: homeDirectory };
  const browserUseExecutable = join(fixture, 'browser-use');
  const playwrightExecutable = join(fixture, 'playwright-cli');
  const agentBrowserExecutable = join(fixture, 'agent-browser');
  const browserUseBundle = join(fixture, 'browser-use-adapter.mjs');
  const playwrightBundle = join(fixture, 'playwright-adapter.mjs');
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    await Promise.all([
      writeFile(agentBrowserExecutable, '#!/bin/sh\n', { mode: 0o700 }),
      writeFile(browserUseExecutable, '#!/bin/sh\n', { mode: 0o700 }),
      writeFile(playwrightExecutable, '#!/bin/sh\n', { mode: 0o700 }),
      writeFile(browserUseBundle, 'browser-use adapter\n'),
      writeFile(playwrightBundle, 'playwright adapter\n'),
    ]);
    await registerPanerelayProvider('/tmp/panerelay-host', { homeDirectory });
    await configureGlobalProvider({ homeDirectory });
    await installBrowserUseIntegrationArtifacts({
      adapterBundlePath: browserUseBundle,
      browserUseVersions: {
        browserHarness: '0.1.8',
        browserUse: '0.13.7',
        browserUseExecutable,
      },
      environment,
      homeDirectory,
    });
    await installPlaywrightIntegration({
      adapterBundlePath: playwrightBundle,
      homeDirectory,
      nodePath: process.execPath,
      playwrightInstallation: {
        executable: playwrightExecutable,
        supported: true,
        version: '0.1.17',
      },
    });
    assert.deepEqual(await readInteractiveSetupState({ homeDirectory }), {
      defaultIntegrations: ['agentBrowser', 'browserUse'],
      globalDefault: true,
      integrations: ['agentBrowser', 'browserUse', 'playwright'],
    });

    assert.equal(
      await main([], {
        confirmDefault: async () => {
          throw new Error('An empty selection must not ask for a default');
        },
        environment,
        interactive: () => true,
        selectIntegrations: async prompt => {
          assert.deepEqual(prompt.initialValues, ['agentBrowser', 'browserUse', 'playwright']);
          return [];
        },
        setup: options =>
          setupPanerelay(
            { ...options, homeDirectory },
            {
              installGlobalCli: async version => ({
                managed: true,
                operation: 'current',
                packageSpec: `@panerelay/cli@${version}`,
                version,
              }),
              installHost: async () => ({
                ...versionedHostFixture,
                extensionId: PANERELAY_EXTENSION_ID,
                hostPath: '/tmp/host.mjs',
                launchPath: '/tmp/host',
                legacyHostPath: '/tmp/legacy-host',
                manifestPaths: ['/tmp/manifest.json'],
                runtimeConfigPath: '/tmp/runtime.json',
              }),
            },
          ),
        systemLocale: 'en',
      }),
      0,
    );

    assert.deepEqual(await readInteractiveSetupState({ homeDirectory }), {
      defaultIntegrations: [],
      globalDefault: false,
      integrations: [],
    });
    assert.equal(await readFile(agentBrowserExecutable, 'utf8'), '#!/bin/sh\n');
    assert.equal(await readFile(browserUseExecutable, 'utf8'), '#!/bin/sh\n');
    assert.equal(await readFile(playwrightExecutable, 'utf8'), '#!/bin/sh\n');
  } finally {
    console.log = originalLog;
    await rm(fixture, { force: true, recursive: true });
  }
});

test('does not ask for a default when only Playwright is selected interactively', async () => {
  let received: Record<string, unknown> | undefined;
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    const code = await main([], {
      environment: {},
      interactive: () => true,
      readInteractiveState: async () => ({
        defaultIntegrations: [],
        globalDefault: false,
        integrations: [],
      }),
      selectIntegrations: async () => ['playwright'],
      confirmDefault: async () => {
        throw new Error('Playwright cannot become the user default');
      },
      setup: async options => {
        received = { ...options };
        return {
          globalDefault: false,
          host: {
            ...versionedHostFixture,
            extensionId: PANERELAY_EXTENSION_ID,
            hostPath: '/tmp/host.mjs',
            launchPath: '/tmp/host',
            legacyHostPath: '/tmp/legacy-host',
            manifestPaths: ['/tmp/manifest.json'],
            runtimeConfigPath: '/tmp/runtime.json',
          },
          playwrightInstallation: { supported: false },
        };
      },
      systemLocale: 'en',
    });
    assert.equal(code, 1);
  } finally {
    console.log = originalLog;
  }
  assert.equal(received?.agentBrowser, false);
  assert.equal(received?.browserUse, false);
  assert.equal(received?.playwright, true);
  assert.equal(received?.globalDefault, false);
  assert.equal(received?.reconcileIntegrations, true);
});

test('allows an empty interactive selection without printing redundant integration guidance', async () => {
  const output: string[] = [];
  let received: Record<string, unknown> | undefined;
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const code = await main([], {
      environment: {},
      interactive: () => true,
      readInteractiveState: async () => ({
        defaultIntegrations: [],
        globalDefault: false,
        integrations: ['browserUse'],
      }),
      selectIntegrations: async () => [],
      confirmDefault: async () => {
        throw new Error('No integration supports a user default');
      },
      setup: async options => {
        received = { ...options };
        return {
          globalDefault: false,
          host: {
            ...versionedHostFixture,
            extensionId: PANERELAY_EXTENSION_ID,
            hostPath: '/tmp/host.mjs',
            launchPath: '/tmp/host',
            legacyHostPath: '/tmp/legacy-host',
            manifestPaths: ['/tmp/manifest.json'],
            runtimeConfigPath: '/tmp/runtime.json',
          },
          removedBrowserUseIntegration: {
            detachedDaemonMayRemain: true,
            gatewayStop: 'remaining',
            paths: {
              adapterArtifactPath: '/tmp/browser-use-adapter.mjs',
              adapterLauncherPath: '/tmp/browser-use-adapter',
              adapterPackagePath: '/tmp/browser-use/package.json',
              adapterStorageDirectory: '/tmp/browser-use',
              browserUseDirectory: '/tmp/browser-use',
              dataDirectory: '/tmp/panerelay',
              integrationConfigPath: '/tmp/browser-use/config.json',
              runtimeDirectory: '/tmp/browser-use/runtime',
            },
            registry: { adapters: [], protocol: 'panerelay.cli-adapter-registry.v1' },
            runtimeStateRemoved: true,
          },
        };
      },
      systemLocale: 'en',
    });
    assert.equal(code, 0);
  } finally {
    console.log = originalLog;
  }
  assert.equal(received?.agentBrowser, false);
  assert.equal(received?.browserUse, false);
  assert.equal(received?.playwright, false);
  assert.equal(received?.reconcileIntegrations, true);
  assert.doesNotMatch(output.join('\n'), /Optional automation integrations|ℹ️/);
  assert.match(output.join('\n'), /detached daemon/);
});

test('cancels interactive setup before lifecycle changes', async () => {
  const errors: string[] = [];
  let setupCalls = 0;
  const originalError = console.error;
  console.error = (...values: unknown[]) => errors.push(values.join(' '));
  const setup = async () => {
    setupCalls += 1;
    throw new Error('setup should not run after cancellation');
  };
  try {
    assert.equal(
      await main([], {
        environment: {},
        interactive: () => true,
        readInteractiveState: async () => ({
          defaultIntegrations: [],
          globalDefault: false,
          integrations: [],
        }),
        selectIntegrations: async () => undefined,
        setup,
        systemLocale: 'en',
      }),
      2,
    );
    assert.equal(
      await main(['--lang', 'zh-CN'], {
        confirmDefault: async () => undefined,
        environment: {},
        interactive: () => true,
        readInteractiveState: async () => ({
          defaultIntegrations: [],
          globalDefault: false,
          integrations: ['agentBrowser'],
        }),
        selectIntegrations: async () => ['agentBrowser'],
        setup,
        systemLocale: 'en',
      }),
      2,
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(setupCalls, 0);
  assert.deepEqual(errors, ['Setup cancelled.', '已取消安装。']);
});

test('reports an incompatible selected Browser Use integration without installing it silently', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const code = await main(['--browser-use', '--lang', 'zh-CN'], {
      environment: {},
      setup: async () => ({
        browserUseReady: false,
        browserUseVersions: { browserHarness: '0.1.7', browserUse: '0.13.6' },
        globalDefault: false,
        host: {
          ...versionedHostFixture,
          extensionId: PANERELAY_EXTENSION_ID,
          hostPath: '/tmp/host.mjs',
          launchPath: '/tmp/host',
          legacyHostPath: '/tmp/legacy-host',
          manifestPaths: ['/tmp/manifest.json'],
          runtimeConfigPath: '/tmp/runtime.json',
        },
      }),
      systemLocale: 'en',
    });
    assert.equal(code, 1);
    assert.match(output.join('\n'), /Browser Use 0\.13\.7 或更高版本/);
    assert.match(output.join('\n'), /使用 --browser-use 重新运行 setup/);
    assert.doesNotMatch(output.join('\n'), /Browser Harness|browser-harness/);
  } finally {
    console.log = originalLog;
  }
});

test('reports an incompatible selected agent-browser version before failing setup', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const code = await main(['--agent-browser', '--lang', 'zh-CN'], {
      environment: {},
      setup: async () => ({
        agentBrowserInstallation: {
          executable: '/tmp/agent-browser',
          supported: false,
          version: '0.32.9',
        },
        globalDefault: false,
        host: {
          ...versionedHostFixture,
          extensionId: PANERELAY_EXTENSION_ID,
          hostPath: '/tmp/host.mjs',
          launchPath: '/tmp/host',
          legacyHostPath: '/tmp/legacy-host',
          manifestPaths: ['/tmp/manifest.json'],
          runtimeConfigPath: '/tmp/runtime.json',
        },
      }),
      systemLocale: 'en',
    });
    assert.equal(code, 1);
    assert.match(output.join('\n'), /agent-browser 0\.32\.9 不受支持/);
    assert.match(output.join('\n'), /0\.33\.0 或更高版本/);
    assert.doesNotMatch(output.join('\n'), /Agent 命令/);
  } finally {
    console.log = originalLog;
  }
});

test('reports a missing selected Playwright CLI without rendering integration artifacts', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const code = await main(['--playwright', '--lang', 'zh-CN'], {
      environment: {},
      setup: async () => ({
        globalDefault: false,
        host: {
          ...versionedHostFixture,
          extensionId: PANERELAY_EXTENSION_ID,
          hostPath: '/tmp/host.mjs',
          launchPath: '/tmp/host',
          legacyHostPath: '/tmp/legacy-host',
          manifestPaths: ['/tmp/manifest.json'],
          runtimeConfigPath: '/tmp/runtime.json',
        },
        playwrightInstallation: { supported: false },
      }),
      systemLocale: 'en',
    });
    assert.equal(code, 1);
  } finally {
    console.log = originalLog;
  }
  const rendered = output.join('\n');
  assert.match(rendered, /Playwright CLI — 未找到/);
  assert.match(rendered, /Playwright CLI 0\.1\.17 或更高版本/);
  assert.match(rendered, /使用 --playwright 重新运行 setup/);
  assert.doesNotMatch(rendered, /Playwright 配置|playwright-cli attach/);
});

test('runs setup when the action is omitted', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  let receivedGlobalDefault = false;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const code = await main(['--agent-browser', '--global-default'], {
      environment: {},
      setup: async options => {
        receivedGlobalDefault = options?.globalDefault === true;
        return {
          agentBrowserInstallation: {
            executable: '/tmp/agent-browser',
            supported: true,
            version: '0.33.0',
          },
          agentBrowserConfigPath: '/tmp/agent-browser.json',
          globalDefault: true,
          host: {
            ...versionedHostFixture,
            extensionId: PANERELAY_EXTENSION_ID,
            hostPath: '/tmp/host.mjs',
            launchPath: '/tmp/host',
            legacyHostPath: '/tmp/legacy-host',
            manifestPaths: ['/tmp/manifest.json'],
            runtimeConfigPath: '/tmp/runtime.json',
          },
        };
      },
      systemLocale: 'en',
    });
    assert.equal(code, 0);
    assert.equal(receivedGlobalDefault, true);
    assert.match(output.join('\n'), /Panerelay setup complete/);
    assert.match(output.join('\n'), /Agent command: agent-browser tab list/);
    assert.match(output.join('\n'), new RegExp(chromeWebStoreUrl.replaceAll('.', '\\.')));
  } finally {
    console.log = originalLog;
  }
});

test('does not print missing optional-tool guidance after setup', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(
      await main(['--lang', 'zh-CN'], {
        environment: {},
        setup: async () => ({
          globalDefault: false,
          host: {
            ...versionedHostFixture,
            codexPath: '/tmp/codex',
            extensionId: PANERELAY_EXTENSION_ID,
            hostPath: '/tmp/host.mjs',
            launchPath: '/tmp/host',
            legacyHostPath: '/tmp/legacy-host',
            manifestPaths: ['/tmp/manifest.json'],
            runtimeConfigPath: '/tmp/runtime.json',
          },
        }),
        systemLocale: 'en',
      }),
      0,
    );
  } finally {
    console.log = originalLog;
  }
  const rendered = output.join('\n');
  assert.doesNotMatch(rendered, /OpenCode|可选工具|PANERELAY_OPENCODE_PATH/);
  assert.match(rendered, /Panerelay 安装完成/);
});

test('does not print detected optional tools after setup', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(
      await main(['--lang', 'en'], {
        environment: {},
        interactive: () => false,
        setup: async () => ({
          globalDefault: false,
          host: {
            ...versionedHostFixture,
            codexPath: '/tmp/codex',
            extensionId: PANERELAY_EXTENSION_ID,
            hostPath: '/tmp/host.mjs',
            launchPath: '/tmp/host',
            legacyHostPath: '/tmp/legacy-host',
            manifestPaths: ['/tmp/manifest.json'],
            opencodePath: '/tmp/opencode',
            opencodeVersion: '1.18.12',
            runtimeConfigPath: '/tmp/runtime.json',
          },
        }),
        systemLocale: 'en',
      }),
      0,
    );
  } finally {
    console.log = originalLog;
  }
  const rendered = output.join('\n');
  assert.doesNotMatch(rendered, /Optional tools|Codex|OpenCode|PANERELAY_OPENCODE_PATH/);
});

test('uses the Browser Use default selection as the global default', async () => {
  let received: Record<string, unknown> | undefined;
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    const code = await main([], {
      environment: {},
      interactive: () => true,
      readInteractiveState: async () => ({
        defaultIntegrations: [],
        globalDefault: false,
        integrations: ['browserUse'],
      }),
      selectIntegrations: async () => ['browserUse'],
      confirmDefault: async () => true,
      setup: async options => {
        received = { ...options };
        return {
          browserUseReady: true,
          globalDefault: true,
          host: {
            ...versionedHostFixture,
            extensionId: PANERELAY_EXTENSION_ID,
            hostPath: '/tmp/host.mjs',
            launchPath: '/tmp/host',
            legacyHostPath: '/tmp/legacy-host',
            manifestPaths: ['/tmp/manifest.json'],
            runtimeConfigPath: '/tmp/runtime.json',
          },
        };
      },
      systemLocale: 'en',
    });
    assert.equal(code, 0);
  } finally {
    console.log = originalLog;
  }
  assert.equal(received?.agentBrowser, false);
  assert.equal(received?.browserUse, true);
  assert.equal(received?.globalDefault, true);
  assert.equal(received?.browserUseDefault, 'extension');
});

test('renders explicit commands only for selected integrations', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const browserUseIntegration: BrowserUseIntegrationInstallation = {
      config: {
        adapterId: 'browser-use',
        adapterLauncherPath: '/tmp/panerelay-browser-use-adapter',
        protocol: 'panerelay.browser-use-integration.v1',
        runtimeDirectory: '/tmp/panerelay-browser-use/runtime',
        runtimeName: 'panerelay',
        version: '0.2.0',
      },
      paths: {
        adapterArtifactPath: '/tmp/panerelay-browser-use-adapter.mjs',
        adapterLauncherPath: '/tmp/panerelay-browser-use-adapter',
        adapterPackagePath: '/tmp/panerelay-browser-use/package.json',
        adapterStorageDirectory: '/tmp/panerelay-browser-use',
        browserUseDirectory: '/tmp/panerelay-browser-use',
        dataDirectory: '/tmp/panerelay',
        integrationConfigPath: '/tmp/panerelay-browser-use/config.json',
        runtimeDirectory: '/tmp/panerelay-browser-use/runtime',
      },
      registration: {
        adapterId: 'browser-use',
        version: '0.2.0',
        executablePath: '/tmp/panerelay-browser-use-adapter',
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
    const setup = async () => ({
      agentBrowserInstallation: {
        executable: '/tmp/agent-browser',
        supported: true,
        version: '0.33.0',
      },
      browserUseReady: true,
      browserUseIntegration,
      browserUseVersions: {
        browserHarness: '0.1.8',
        browserUse: '0.13.7',
        browserUseExecutable: '/tmp/browser-use',
      },
      globalDefault: false,
      host: {
        ...versionedHostFixture,
        extensionId: PANERELAY_EXTENSION_ID,
        hostPath: '/tmp/host.mjs',
        launchPath: '/tmp/host',
        legacyHostPath: '/tmp/legacy-host',
        manifestPaths: ['/tmp/manifest.json'],
        runtimeConfigPath: '/tmp/runtime.json',
      },
    });

    assert.equal(
      await main(['--agent-browser', '--browser-use'], {
        environment: { HOME: '/tmp/setup-home' },
        setup,
        systemLocale: 'en',
      }),
      0,
    );
    const explicit = output.join('\n');
    assert.match(explicit, /Agent command: agent-browser --provider panerelay tab list/);
    assert.match(
      explicit,
      /Browser Use command:\nBU_CDP_URL=http:\/\/127\.0\.0\.1:43827\/cdp\/browser-use browser-use/,
    );
    assert.match(explicit, /print\(list_tabs\(\)\)/);
    assert.match(
      explicit,
      /Browser Harness environment — \/tmp\/setup-home\/\.config\/browser-harness\/agent-workspace\/\.env/,
    );
    assert.doesNotMatch(explicit, /User default:/);
    output.length = 0;

    assert.equal(
      await main(['--browser-use', '--global-default'], {
        environment: { HOME: '/tmp/setup-home' },
        setup: async options => ({
          ...(await setup()),
          globalDefault: options?.globalDefault === true,
        }),
        systemLocale: 'en',
      }),
      0,
    );
    const defaults = output.join('\n');
    assert.doesNotMatch(defaults, /Agent command:/);
    assert.match(defaults, /Browser Use command:\nbrowser-use/);
    assert.doesNotMatch(defaults, /BU_CDP_URL=/);
    assert.match(
      defaults,
      /User default — \/tmp\/setup-home\/\.config\/browser-harness\/agent-workspace\/\.env/,
    );
    output.length = 0;

    assert.equal(
      await main(['--playwright'], {
        environment: { HOME: '/tmp/setup-home' },
        setup: async options => {
          assert.equal(options?.playwright, true);
          assert.equal(options?.agentBrowser, false);
          assert.equal(options?.browserUse, false);
          assert.equal(options?.globalDefault, false);
          return {
            globalDefault: false,
            host: (await setup()).host,
            playwrightInstallation: {
              executable: '/tmp/playwright-cli',
              supported: true,
              version: '0.1.17',
            },
            playwrightIntegration: {
              paths: {
                adapterArtifactPath: '/tmp/playwright-adapter.mjs',
                adapterLauncherPath: '/tmp/panerelay-playwright-adapter',
                adapterPackagePath: '/tmp/playwright-adapter/package.json',
                adapterStorageDirectory: '/tmp/playwright-adapter',
                configPath: '/tmp/panerelay/playwright/config.json',
                dataDirectory: '/tmp/panerelay',
              },
              registration: {
                adapterId: 'playwright',
                version: '0.4.0',
                executablePath: '/tmp/panerelay-playwright-adapter',
                protocol: 'panerelay.cli-adapter.v1',
                capabilities: ['connection.resolve', 'adapter.doctor'],
                modes: ['direct', 'extension'],
                childEnvironmentKeys: ['PLAYWRIGHT_MCP_CDP_ENDPOINT'],
              },
              registry: { protocol: 'panerelay.cli-adapter-registry.v1', adapters: [] },
            },
          };
        },
        systemLocale: 'en',
      }),
      0,
    );
    const playwright = output.join('\n');
    assert.doesNotMatch(playwright, /Agent Skill/);
    assert.match(
      playwright,
      /playwright-cli attach --cdp http:\/\/127\.0\.0\.1:43827\/cdp\/playwright/,
    );
    assert.doesNotMatch(playwright, /User default/);
  } finally {
    console.log = originalLog;
  }
});

test('directs custom Extension IDs to their matching build instead of the Store', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const code = await main(['--extension-id', extensionId, '--lang', 'zh-CN'], {
      environment: {},
      setup: async () => ({
        globalDefault: false,
        host: {
          ...versionedHostFixture,
          extensionId,
          hostPath: '/tmp/host.mjs',
          launchPath: '/tmp/host',
          legacyHostPath: '/tmp/legacy-host',
          manifestPaths: ['/tmp/manifest.json'],
          runtimeConfigPath: '/tmp/runtime.json',
        },
      }),
      systemLocale: 'en',
    });
    assert.equal(code, 0);
  } finally {
    console.log = originalLog;
  }
  const rendered = output.join('\n');
  assert.match(rendered, new RegExp(`请加载与 ID ${extensionId} 匹配的构建`));
  assert.doesNotMatch(rendered, /chromewebstore\.google\.com/);
});

test('accepts language options before or after the command', () => {
  assert.equal(parseSetupArgs(['--lang', 'zh-CN', 'doctor']).language, 'zh-CN');
  assert.equal(parseSetupArgs(['doctor', '--lang=en']).language, 'en');
  assert.throws(() => parseSetupArgs(['--lang', 'ja']), /LANGUAGE_UNSUPPORTED:ja/);
  assert.throws(() => parseSetupArgs(['--lang', 'en', '--lang', 'zh-CN']), /LANGUAGE_REPEATED/);
});

test('rejects browser administration commands moved to @panerelay/cli', () => {
  assert.throws(() => parseSetupArgs(['browsers']), /Unknown command: browsers/);
  assert.throws(() => parseSetupArgs(['browser', 'use', 'edge']), /Unknown command: browser/);
  assert.throws(() => parseSetupArgs(['browser', 'clear']), /Unknown command: browser/);
});

test('parses custom Extension IDs for setup and doctor', () => {
  const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
  assert.equal(parseSetupArgs(['update', '--extension-id', extensionId]).extensionId, extensionId);
  assert.equal(
    parseSetupArgs(['doctor', `--extension-id=${extensionId}`]).extensionId,
    extensionId,
  );
  assert.throws(() => parseSetupArgs(['setup', '--extension-id']), /EXTENSION_ID_MISSING/);
  assert.throws(
    () =>
      parseSetupArgs(['setup', `--extension-id=${extensionId}`, `--extension-id=${extensionId}`]),
    /EXTENSION_ID_REPEATED/,
  );
  assert.throws(
    () => parseSetupArgs(['uninstall', `--extension-id=${extensionId}`]),
    /not available with uninstall/,
  );
});

test('prints help in the explicit or detected system language', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(await main(['--help'], { environment: {}, systemLocale: 'zh-CN' }), 0);
    const chineseHelp = output.join('\n');
    assert.match(chineseHelp, /用法：/);
    assert.match(chineseHelp, /--global-default[\s\S]*用户级默认/);
    assert.doesNotMatch(chineseHelp, /^\s*setup\s+/m);
    assert.doesNotMatch(chineseHelp, /--project-provider|--global-provider/);
    output.length = 0;
    assert.equal(
      await main(['--help', '--lang', 'en'], {
        environment: { PANERELAY_LANG: 'zh-CN' },
        systemLocale: 'zh-CN',
      }),
      0,
    );
    const englishHelp = output.join('\n');
    assert.match(englishHelp, /Usage:/);
    assert.match(englishHelp, /--global-default[\s\S]*user-level defaults/);
    assert.doesNotMatch(englishHelp, /^\s*setup\s+/m);
    assert.doesNotMatch(englishHelp, /--project-provider|--global-provider/);
  } finally {
    console.log = originalLog;
  }
});

test('groups human-readable doctor checks with actionable remediation', async () => {
  const report: DoctorReport = {
    checks: [
      {
        detail: 'No valid Panerelay manifest was found',
        hint: 'Run: npx --yes @panerelay/setup',
        id: 'native-manifest',
        label: 'Chrome Native Messaging manifest',
        status: 'fail',
      },
      {
        detail: 'v25.0.0',
        id: 'node',
        label: 'Node.js',
        status: 'pass',
      },
      {
        detail: 'Connected through process 42345',
        id: 'extension',
        label: 'Panerelay Extension connection',
        status: 'pass',
      },
    ],
    ok: false,
  };
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(
      await main(['doctor', '--lang', 'en'], {
        doctor: async () => report,
        environment: {},
        systemLocale: 'en',
      }),
      1,
    );
  } finally {
    console.log = originalLog;
  }
  const rendered = output.join('\n');
  assert.match(rendered, /^Panerelay doctor/m);
  assert.match(rendered, /Environment\n {2}✅ Node\.js — v25\.0\.0/);
  assert.match(
    rendered,
    /Local integration\n {2}❌ Native Messaging manifest — No valid Panerelay manifest was found/,
  );
  assert.match(rendered, /Fix: Run: npx --yes @panerelay\/setup/);
  assert.match(rendered, /Browser connection\n {2}✅ Extension — Connected through process 42345/);
  assert.match(rendered, /❌ Panerelay needs attention\./);
  assert.match(rendered, /Failed checks: 1/);
  assert.doesNotMatch(rendered, /\b(?:PASS|FAIL|WARN)\b/);
});

test('localizes Chrome and Edge Native Messaging registry checks independently', async () => {
  const report: DoctorReport = {
    checks: [
      {
        detail: 'C:\\Panerelay\\manifest.json',
        id: 'windows-registry-chrome',
        label: 'Chrome Native Messaging registry',
        status: 'pass',
      },
      {
        detail: 'Not found',
        hint: 'Run: npx --yes @panerelay/setup',
        id: 'windows-registry-edge',
        label: 'Edge Native Messaging registry',
        status: 'fail',
      },
    ],
    ok: false,
  };
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(
      await main(['doctor', '--lang', 'zh-CN'], {
        doctor: async () => report,
        environment: {},
        systemLocale: 'en',
      }),
      1,
    );
  } finally {
    console.log = originalLog;
  }
  const rendered = output.join('\n');
  assert.match(rendered, /Chrome Native Messaging 注册表/);
  assert.match(rendered, /Edge Native Messaging 注册表 — 未找到/);
});

test('keeps doctor JSON identical across supported languages', async () => {
  const report: DoctorReport = {
    checks: [
      {
        detail: 'Extension is not currently connected',
        hint: 'Load or reload the extension, then open its side panel',
        id: 'extension',
        label: 'Panerelay Extension connection',
        status: 'warn',
      },
    ],
    ok: true,
  };
  const render = async (language: 'en' | 'zh-CN') => {
    const output: string[] = [];
    const originalLog = console.log;
    console.log = (...values: unknown[]) => output.push(values.join(' '));
    try {
      assert.equal(
        await main(['doctor', '--json', '--lang', language], {
          doctor: async () => report,
          environment: {},
          systemLocale: 'en',
        }),
        0,
      );
      return output.join('\n');
    } finally {
      console.log = originalLog;
    }
  };
  assert.equal(await render('zh-CN'), await render('en'));
});
