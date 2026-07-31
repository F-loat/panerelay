import assert from 'node:assert/strict';
import test from 'node:test';
import { PANERELAY_EXTENSION_ID } from '@panerelay/protocol';
import { main, parseSetupArgs } from './cli.js';
import type { DoctorReport } from './doctor.js';

const chromeWebStoreUrl =
  'https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi';

test('parses setup aliases and Provider scope flags', () => {
  assert.deepEqual(parseSetupArgs([]), {
    globalProvider: false,
    help: false,
    json: false,
    language: undefined,
    operation: 'setup',
    project: false,
    yes: false,
  });
  assert.deepEqual(parseSetupArgs(['install', '--project-provider', '--global-provider']), {
    globalProvider: true,
    help: false,
    json: false,
    language: undefined,
    operation: 'setup',
    project: true,
    yes: false,
  });
  assert.deepEqual(parseSetupArgs(['doctor', '--global-provider', '--json']), {
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
    () => parseSetupArgs(['uninstall', '--global-provider']),
    /--global-provider is not needed/,
  );
});

test('runs setup when the action is omitted', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  let receivedGlobalProvider = false;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const code = await main(['--global-provider'], {
      environment: {},
      setup: async options => {
        receivedGlobalProvider = options?.globalProvider === true;
        return {
          agentBrowserConfigPath: '/tmp/agent-browser.json',
          globalProvider: true,
          globalSkillPath: '/tmp/panerelay-browser',
          host: {
            agentBrowserConfigPath: '/tmp/agent-browser.json',
            agentBrowserPath: '/tmp/agent-browser',
            agentBrowserSupported: true,
            extensionId: PANERELAY_EXTENSION_ID,
            firefoxExtensionId: 'panerelay@f-loat.dev',
            firefoxAutomationReady: false,
            firefoxLauncherPath: '/tmp/panerelay-firefox',
            firefoxRuntimeStatePath: '/tmp/firefox-runtime.json',
            hostPath: '/tmp/host.mjs',
            launchPath: '/tmp/host',
            legacyHostPath: '/tmp/legacy-host',
            legacyManifestPaths: [],
            chromiumManifestPaths: ['/tmp/chromium-manifest.json'],
            firefoxManifestPaths: ['/tmp/firefox-manifest.json'],
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
        agentBrowserConfigPath: '/tmp/agent-browser.json',
        globalProvider: false,
        globalSkillPath: '/tmp/panerelay-browser',
        host: {
          agentBrowserConfigPath: '/tmp/agent-browser.json',
          agentBrowserPath: '/tmp/agent-browser',
          agentBrowserSupported: true,
          extensionId,
          firefoxExtensionId: 'panerelay@f-loat.dev',
          firefoxAutomationReady: false,
          firefoxLauncherPath: '/tmp/panerelay-firefox',
          firefoxRuntimeStatePath: '/tmp/firefox-runtime.json',
          hostPath: '/tmp/host.mjs',
          launchPath: '/tmp/host',
          legacyHostPath: '/tmp/legacy-host',
          legacyManifestPaths: [],
          chromiumManifestPaths: ['/tmp/chromium-manifest.json'],
          firefoxManifestPaths: ['/tmp/firefox-manifest.json'],
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

test('parses custom Extension IDs for setup and doctor', () => {
  const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
  const firefoxExtensionId = 'custom-panerelay@example.com';
  assert.equal(parseSetupArgs(['update', '--extension-id', extensionId]).extensionId, extensionId);
  assert.equal(
    parseSetupArgs(['doctor', `--extension-id=${extensionId}`]).extensionId,
    extensionId,
  );
  assert.equal(
    parseSetupArgs(['setup', '--firefox-extension-id', firefoxExtensionId]).firefoxExtensionId,
    firefoxExtensionId,
  );
  assert.equal(
    parseSetupArgs(['doctor', `--firefox-extension-id=${firefoxExtensionId}`]).firefoxExtensionId,
    firefoxExtensionId,
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
  assert.throws(
    () => parseSetupArgs(['uninstall', `--firefox-extension-id=${firefoxExtensionId}`]),
    /not available with uninstall/,
  );
});

test('prints help in the explicit or detected system language', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(await main(['--help'], { environment: {}, systemLocale: 'zh-CN' }), 0);
    assert.match(output.join('\n'), /用法：/);
    output.length = 0;
    assert.equal(
      await main(['--help', '--lang', 'en'], {
        environment: { PANERELAY_LANG: 'zh-CN' },
        systemLocale: 'zh-CN',
      }),
      0,
    );
    assert.match(output.join('\n'), /Usage:/);
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
