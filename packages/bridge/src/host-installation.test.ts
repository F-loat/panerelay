import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  installNativeHost,
  nativeHostManifestPaths,
  parseWindowsRegistryString,
  registerWindowsNativeHost,
  resolveEffectiveExtensionId,
  resolveEffectiveFirefoxExtensionId,
  resolveNativeHostInstallationPaths,
  uninstallNativeHost,
  validateExtensionId,
  validateFirefoxExtensionId,
  windowsLauncherContent,
  windowsNativeHostRegistryKey,
} from './host-installation.js';
import type { CommandRunner } from './platform.js';

const officialExtensionId = 'panplnkjlkoceaonlmpdekjphgmbggmi';
const customExtensionId = 'abcdefghijklmnopabcdefghijklmnop';
const firefoxExtensionId = 'panerelay-test@example.com';

test('fails clearly on unsupported Native Messaging platforms', () => {
  assert.throws(
    () => nativeHostManifestPaths({ platform: 'freebsd' }),
    /Native Messaging installation is not implemented for freebsd/,
  );
});

test('validates and resolves Extension ID precedence', () => {
  assert.equal(validateExtensionId(officialExtensionId), officialExtensionId);
  assert.throws(() => validateExtensionId('extension-test'), /exactly 32 lowercase letters/);
  assert.equal(
    resolveEffectiveExtensionId({
      environment: { PANERELAY_EXTENSION_ID: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      extensionId: customExtensionId,
      persistedExtensionId: 'cccccccccccccccccccccccccccccccc',
    }),
    customExtensionId,
  );
  assert.equal(validateFirefoxExtensionId(firefoxExtensionId), firefoxExtensionId);
  assert.equal(validateFirefoxExtensionId('@addon-example'), '@addon-example');
  assert.throws(() => validateFirefoxExtensionId('bad id/'), /Firefox Extension ID/);
  assert.throws(() => validateFirefoxExtensionId('plain-id'), /Firefox Extension ID/);
  assert.throws(
    () => validateFirefoxExtensionId(`${'a'.repeat(72)}@example.com`),
    /at most 80 characters/,
  );
  assert.equal(
    validateFirefoxExtensionId('{daf44bf7-a45e-4450-979c-91cf07434c3d}'),
    '{daf44bf7-a45e-4450-979c-91cf07434c3d}',
  );
  assert.equal(
    resolveEffectiveFirefoxExtensionId({
      environment: { PANERELAY_FIREFOX_EXTENSION_ID: 'environment@example.com' },
      firefoxExtensionId,
      persistedFirefoxExtensionId: 'persisted@example.com',
    }),
    firefoxExtensionId,
  );
  assert.equal(
    resolveEffectiveExtensionId({
      environment: {},
      persistedExtensionId: customExtensionId,
    }),
    customExtensionId,
  );
});

test('installs and removes an isolated Native Messaging host', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-host-'));
  const homeDirectory = join(root, 'home');
  const binDirectory = join(root, 'bin');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  await mkdir(binDirectory, { recursive: true });
  await writeFile(bundledHostPath, '#!/usr/bin/env node\nprocess.stdout.write("ready");\n');
  for (const executable of ['agent-browser', 'claude', 'codex', 'firefox', 'geckodriver']) {
    const path = join(binDirectory, executable);
    await writeFile(
      path,
      executable === 'agent-browser'
        ? '#!/bin/sh\necho "agent-browser 0.33.0"\n'
        : executable === 'firefox'
          ? '#!/bin/sh\necho "Mozilla Firefox 141.0.0"\n'
          : executable === 'geckodriver'
            ? '#!/bin/sh\necho "geckodriver 0.36.0"\n'
            : executable === 'claude'
              ? '#!/bin/sh\necho "2.1.0 (Claude Code)"\n'
              : '#!/bin/sh\nexit 0\n',
    );
    await chmod(path, 0o755);
  }

  try {
    const result = await installNativeHost({
      bundledHostPath,
      environment: { PATH: binDirectory },
      extensionId: customExtensionId,
      firefoxExtensionId,
      homeDirectory,
      nodePath: '/test/node',
      platform: 'linux',
    });

    assert.equal(result.agentBrowserPath, join(binDirectory, 'agent-browser'));
    assert.equal(result.agentBrowserSupported, true);
    assert.equal(result.agentBrowserVersion, '0.33.0');
    assert.equal(result.codexPath, join(binDirectory, 'codex'));
    assert.equal(result.claudePath, join(binDirectory, 'claude'));
    assert.equal(result.claudeVersion, '2.1.0');
    assert.equal(result.firefoxExtensionId, firefoxExtensionId);
    assert.equal(result.firefoxPath, join(binDirectory, 'firefox'));
    assert.equal(result.firefoxVersion, '141.0.0');
    assert.equal(result.geckodriverPath, join(binDirectory, 'geckodriver'));
    assert.equal(result.geckodriverVersion, '0.36.0');
    assert.equal(result.firefoxAutomationReady, true);
    assert.equal(result.launchPath, result.hostPath);
    assert.match(await readFile(result.hostPath, 'utf8'), /^#!\/test\/node\n/);
    assert.equal((await stat(result.hostPath)).mode & 0o777, 0o755);

    const runtime = JSON.parse(await readFile(result.runtimeConfigPath, 'utf8')) as {
      agentBrowserConfigPath: string;
      agentBrowserPath: string;
      agentBrowserVersion: string;
      codexPath: string;
      claudePath: string;
      claudeVersion: string;
      extensionId: string;
      firefoxExtensionId: string;
    };
    assert.equal(runtime.extensionId, customExtensionId);
    assert.equal(runtime.firefoxExtensionId, firefoxExtensionId);
    assert.equal(runtime.agentBrowserConfigPath, result.agentBrowserConfigPath);
    assert.equal(runtime.agentBrowserPath, result.agentBrowserPath);
    assert.equal(runtime.agentBrowserVersion, '0.33.0');
    assert.equal(runtime.codexPath, result.codexPath);
    assert.equal(runtime.claudePath, result.claudePath);
    assert.equal(runtime.claudeVersion, '2.1.0');
    assert.equal((runtime as Record<string, unknown>).firefoxPath, result.firefoxPath);
    assert.equal((runtime as Record<string, unknown>).geckodriverPath, result.geckodriverPath);
    assert.equal(typeof (runtime as Record<string, unknown>).firefoxManagedToken, 'string');
    assert.match(await readFile(result.firefoxLauncherPath, 'utf8'), /--launch-firefox/);
    const privateConfig = JSON.parse(await readFile(result.agentBrowserConfigPath, 'utf8')) as {
      plugins: Array<{ command: string; name: string }>;
    };
    assert.equal(privateConfig.plugins[0]?.name, 'panerelay');
    assert.equal(privateConfig.plugins[0]?.command, result.launchPath);

    for (const manifestPath of result.chromiumManifestPaths) {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        allowed_origins: string[];
        path: string;
      };
      assert.equal(manifest.path, result.launchPath);
      assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${customExtensionId}/`]);
    }
    for (const manifestPath of result.firefoxManifestPaths) {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        allowed_extensions: string[];
        path: string;
      };
      assert.equal(manifest.path, result.launchPath);
      assert.deepEqual(manifest.allowed_extensions, [firefoxExtensionId]);
    }

    await uninstallNativeHost({ homeDirectory, platform: 'linux' });
    const paths = resolveNativeHostInstallationPaths({ homeDirectory, platform: 'linux' });
    await assert.rejects(readFile(paths.hostPath), { code: 'ENOENT' });
    await assert.rejects(readFile(paths.runtimeConfigPath), { code: 'ENOENT' });
    await assert.rejects(readFile(paths.firefoxLauncherPath), { code: 'ENOENT' });
    for (const manifestPath of paths.manifestPaths) {
      await assert.rejects(readFile(manifestPath), { code: 'ENOENT' });
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('creates a quoted Windows launcher and uses exact structured registry arguments', async () => {
  assert.equal(
    windowsLauncherContent(
      'C:\\Program Files\\Node & Tools\\node.exe',
      'C:\\User % Name\\host.cjs',
    ),
    [
      '@echo off',
      'setlocal DisableDelayedExpansion',
      '"C:\\Program Files\\Node & Tools\\node.exe" "C:\\User %% Name\\host.cjs" %*',
      '',
    ].join('\r\n'),
  );
  const calls: Array<{ args: string[]; command: string }> = [];
  await registerWindowsNativeHost('C:\\User & Name\\manifest.json', {
    runner: async (command, args) => {
      calls.push({ args, command });
      return { code: 0, stderr: '', stdout: '' };
    },
  });
  assert.deepEqual(calls, [
    {
      command: 'reg.exe',
      args: [
        'add',
        windowsNativeHostRegistryKey(),
        '/ve',
        '/t',
        'REG_SZ',
        '/d',
        'C:\\User & Name\\manifest.json',
        '/f',
      ],
    },
  ]);
  assert.equal(
    parseWindowsRegistryString(`\r\n    (Default)    REG_SZ    C:\\User & Name\\manifest.json\r\n`),
    'C:\\User & Name\\manifest.json',
  );
});

test('installs, updates, and repeatedly uninstalls isolated Windows artifacts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay windows & host-'));
  const dataDirectory = join(root, 'Panerelay Data');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  const agentBrowserPath = join(root, 'npm wrappers', 'agent-browser.cmd');
  const codexPath = join(root, 'npm wrappers', 'codex.cmd');
  await mkdir(dirname(agentBrowserPath), { recursive: true });
  await writeFile(bundledHostPath, '#!/usr/bin/env node\nprocess.stdout.write("ready");\n');
  await writeFile(agentBrowserPath, '@exit /b 0\r\n');
  await writeFile(codexPath, '@exit /b 0\r\n');
  let deleteCount = 0;
  const registryCalls: Array<{ args: string[]; command: string }> = [];
  const registryRunner: CommandRunner = async (command, args) => {
    registryCalls.push({ args, command });
    if (args[0] === 'delete') {
      deleteCount += 1;
      return { code: deleteCount === 1 ? 0 : 1, stderr: '', stdout: '' };
    }
    return { code: 0, stderr: '', stdout: '' };
  };

  try {
    const first = await installNativeHost({
      bundledHostPath,
      dataDirectory,
      environment: {
        PANERELAY_AGENT_BROWSER_PATH: agentBrowserPath,
        PANERELAY_CODEX_PATH: codexPath,
      },
      extensionId: customExtensionId,
      nodePath: 'C:\\Program Files\\Node & Tools\\node.exe',
      platform: 'win32',
      probeRunner: async () => ({
        code: 0,
        stderr: '',
        stdout: 'agent-browser 0.34.0',
      }),
      registryRunner,
    });
    assert.equal(first.agentBrowserPath, agentBrowserPath);
    assert.equal(first.agentBrowserSupported, true);
    assert.equal(first.agentBrowserVersion, '0.34.0');
    assert.equal(first.codexPath, codexPath);
    assert.equal(first.launchPath, first.launcherPath);
    assert.match(await readFile(first.launchPath, 'utf8'), /^@echo off\r\n/);
    const manifest = JSON.parse(await readFile(first.manifestPaths[0]!, 'utf8')) as {
      allowed_origins: string[];
      path: string;
    };
    assert.equal(manifest.path, first.launchPath);
    assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${customExtensionId}/`]);
    const privateConfig = JSON.parse(await readFile(first.agentBrowserConfigPath, 'utf8')) as {
      plugins: Array<{ command: string }>;
    };
    assert.equal(privateConfig.plugins[0]?.command, first.launchPath);

    await mkdir(dirname(first.legacyManifestPaths[0]!), { recursive: true });
    await writeFile(first.legacyManifestPaths[0]!, '{}');
    const updated = await installNativeHost({
      bundledHostPath,
      dataDirectory,
      environment: {
        PANERELAY_AGENT_BROWSER_PATH: agentBrowserPath,
        PANERELAY_CODEX_PATH: codexPath,
      },
      nodePath: 'C:\\Program Files\\Node & Tools\\node.exe',
      platform: 'win32',
      probeRunner: async () => ({
        code: 0,
        stderr: '',
        stdout: 'agent-browser 0.34.0',
      }),
      registryRunner,
    });
    assert.equal(updated.extensionId, customExtensionId);
    await assert.rejects(readFile(first.legacyManifestPaths[0]!), { code: 'ENOENT' });

    await uninstallNativeHost({ dataDirectory, platform: 'win32', registryRunner });
    await uninstallNativeHost({ dataDirectory, platform: 'win32', registryRunner });
    await assert.rejects(readFile(first.hostPath), { code: 'ENOENT' });
    await assert.rejects(readFile(first.launchPath), { code: 'ENOENT' });
    await assert.rejects(readFile(first.manifestPaths[0]!), { code: 'ENOENT' });
    await assert.rejects(readFile(first.legacyManifestPaths[0]!), { code: 'ENOENT' });
    assert.equal(registryCalls.filter(call => call.args[0] === 'add').length, 6);
    assert.equal(registryCalls.filter(call => call.args[0] === 'delete').length, 6);
    assert.ok(
      registryCalls.some(call =>
        call.args.includes(windowsNativeHostRegistryKey(undefined, 'edge')),
      ),
    );
    assert.ok(
      registryCalls.some(call =>
        call.args.includes(windowsNativeHostRegistryKey(undefined, 'firefox')),
      ),
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
