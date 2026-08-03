import assert from 'node:assert/strict';
import test from 'node:test';
import { PANERELAY_EXTENSION_ID } from '@panerelay/protocol';
import { main, parseSetupArgs } from './cli.js';
import type { BrowserUseIntegrationInstallation } from './browser-use-integration.js';
import type { DoctorReport } from './doctor.js';

const chromeWebStoreUrl =
  'https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi';

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
  assert.equal(parseSetupArgs(['doctor', '--browser-use']).browserUse, true);
  assert.equal(parseSetupArgs(['doctor', '--playwright']).playwright, true);
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
            globalSkillPath: '/tmp/panerelay-browser',
          }
        : {}),
      ...(options?.browserUse ? { browserUseReady: true } : {}),
      globalDefault: false,
      host: {
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
  const answers = [true, true, true, false];
  const prompts: string[] = [];
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    const code = await main([], {
      environment: {},
      interactive: () => true,
      prompt: async message => {
        prompts.push(message);
        return answers.shift() ?? false;
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
    assert.equal(selections.length, 1);
    assert.equal(selections[0]?.agentBrowser, true);
    assert.equal(selections[0]?.browserUse, true);
    assert.equal(selections[0]?.globalDefault, true);
    assert.equal(selections[0]?.browserUseDefault, 'direct');

    await main(['--yes'], {
      environment: {},
      interactive: () => true,
      prompt: async () => {
        throw new Error('prompt should not run');
      },
      setup: async options => {
        selections.push({ ...options });
        return {
          globalDefault: false,
          host: {
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
      playwright: false,
      environment: {},
      extensionId: undefined,
      globalDefault: false,
    });
    assert.equal(prompts.length, 4);
    assert.match(prompts[0]!, /agent-browser integration/);
    assert.match(prompts[3]!, /default Browser Use connection/);
  } finally {
    console.log = originalLog;
  }
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
          globalSkillPath: '/tmp/panerelay-browser',
          host: {
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

test('uses the Browser Use default selection as the global default', async () => {
  let received: Record<string, unknown> | undefined;
  const answers = [false, true, true];
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    const code = await main([], {
      environment: {},
      interactive: () => true,
      prompt: async () => answers.shift() ?? false,
      setup: async options => {
        received = { ...options };
        return {
          browserUseReady: true,
          globalDefault: true,
          host: {
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
            playwrightSkillPath: '/tmp/setup-home/.agents/skills/panerelay-playwright',
          };
        },
        systemLocale: 'en',
      }),
      0,
    );
    const playwright = output.join('\n');
    assert.match(playwright, /Playwright Agent Skill/);
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
