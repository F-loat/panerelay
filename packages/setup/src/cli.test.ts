import assert from 'node:assert/strict';
import test from 'node:test';
import { PANERELAY_EXTENSION_ID } from '@panerelay/protocol';
import { main, parseSetupArgs } from './cli.js';
import type { DoctorReport } from './doctor.js';

const chromeWebStoreUrl =
  'https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi';

test('parses setup aliases and Provider scope flags', () => {
  assert.deepEqual(parseSetupArgs([]), {
    agentBrowser: false,
    browserUse: false,
    globalProvider: false,
    help: false,
    json: false,
    language: undefined,
    operation: 'setup',
    project: false,
    yes: false,
  });
  assert.deepEqual(
    parseSetupArgs(['install', '--agent-browser', '--project-provider', '--global-provider']),
    {
      agentBrowser: true,
      browserUse: false,
      globalProvider: true,
      help: false,
      json: false,
      language: undefined,
      operation: 'setup',
      project: true,
      yes: false,
    },
  );
  assert.deepEqual(parseSetupArgs(['doctor', '--agent-browser', '--global-provider', '--json']), {
    agentBrowser: true,
    browserUse: false,
    globalProvider: true,
    help: false,
    json: true,
    language: undefined,
    operation: 'doctor',
    project: false,
    yes: false,
  });
  assert.throws(() => parseSetupArgs(['--project']), /Unknown option: --project/);
  assert.throws(
    () => parseSetupArgs(['--global-provider']),
    /--agent-browser is required with Provider scope options/,
  );
  assert.throws(
    () => parseSetupArgs(['doctor', '--project-provider']),
    /--agent-browser is required with Provider scope options/,
  );
  assert.throws(
    () => parseSetupArgs(['uninstall', '--global-provider']),
    /--global-provider is not needed/,
  );
  assert.equal(parseSetupArgs(['setup', '--browser-use']).browserUse, true);
  assert.equal(parseSetupArgs(['setup', '--agent-browser']).agentBrowser, true);
  assert.equal(parseSetupArgs(['doctor', '--browser-use']).browserUse, true);
  assert.throws(
    () => parseSetupArgs(['uninstall', '--browser-use']),
    /--browser-use is not needed/,
  );
  assert.throws(
    () => parseSetupArgs(['uninstall', '--agent-browser']),
    /--agent-browser is not needed/,
  );
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
      globalProvider: false,
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
          browserUseReady: true,
          globalProvider: options?.globalProvider === true,
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
    assert.equal(selections[0]?.globalProvider, true);
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
          globalProvider: false,
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
      environment: {},
      extensionId: undefined,
      globalProvider: false,
      project: false,
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
        globalProvider: false,
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
        globalProvider: false,
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

test('runs setup when the action is omitted', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  let receivedGlobalProvider = false;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const code = await main(['--agent-browser', '--global-provider'], {
      environment: {},
      setup: async options => {
        receivedGlobalProvider = options?.globalProvider === true;
        return {
          agentBrowserInstallation: {
            executable: '/tmp/agent-browser',
            supported: true,
            version: '0.33.0',
          },
          agentBrowserConfigPath: '/tmp/agent-browser.json',
          globalProvider: true,
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
    assert.equal(receivedGlobalProvider, true);
    assert.match(output.join('\n'), /Panerelay setup complete/);
    assert.match(output.join('\n'), /Agent command: agent-browser --provider panerelay tab list/);
    assert.match(output.join('\n'), new RegExp(chromeWebStoreUrl.replaceAll('.', '\\.')));
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
        globalProvider: false,
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
    assert.match(chineseHelp, /--project-provider.*需要 --agent-browser/);
    assert.match(chineseHelp, /--global-provider[\s\S]*需要 --agent-browser/);
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
    assert.match(englishHelp, /--project-provider.*requires --agent-browser/);
    assert.match(englishHelp, /--global-provider[\s\S]*requires --agent-browser/);
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
