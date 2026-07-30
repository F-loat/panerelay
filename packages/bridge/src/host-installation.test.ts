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
  resolveNativeHostInstallationPaths,
  uninstallNativeHost,
  validateExtensionId,
  windowsLauncherContent,
  windowsNativeHostRegistryKey,
} from './host-installation.js';
import type { CommandRunner } from './platform.js';

const officialExtensionId = 'panplnkjlkoceaonlmpdekjphgmbggmi';
const customExtensionId = 'abcdefghijklmnopabcdefghijklmnop';

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
  for (const executable of ['agent-browser', 'codex']) {
    const path = join(binDirectory, executable);
    await writeFile(
      path,
      executable === 'agent-browser'
        ? '#!/bin/sh\necho "agent-browser 0.33.0"\n'
        : '#!/bin/sh\nexit 0\n',
    );
    await chmod(path, 0o755);
  }

  try {
    const result = await installNativeHost({
      bundledHostPath,
      environment: { PATH: binDirectory },
      extensionId: customExtensionId,
      homeDirectory,
      nodePath: '/test/node',
      platform: 'linux',
    });

    assert.equal(result.agentBrowserPath, join(binDirectory, 'agent-browser'));
    assert.equal(result.agentBrowserSupported, true);
    assert.equal(result.agentBrowserVersion, '0.33.0');
    assert.equal(result.codexPath, join(binDirectory, 'codex'));
    assert.equal(result.launchPath, result.hostPath);
    assert.match(await readFile(result.hostPath, 'utf8'), /^#!\/test\/node\n/);
    assert.equal((await stat(result.hostPath)).mode & 0o777, 0o755);

    const runtime = JSON.parse(await readFile(result.runtimeConfigPath, 'utf8')) as {
      agentBrowserConfigPath: string;
      agentBrowserPath: string;
      agentBrowserVersion: string;
      codexPath: string;
      extensionId: string;
    };
    assert.deepEqual(runtime, {
      extensionId: customExtensionId,
      agentBrowserConfigPath: result.agentBrowserConfigPath,
      agentBrowserPath: result.agentBrowserPath,
      agentBrowserVersion: '0.33.0',
      codexPath: result.codexPath,
    });
    const privateConfig = JSON.parse(await readFile(result.agentBrowserConfigPath, 'utf8')) as {
      plugins: Array<{ command: string; name: string }>;
    };
    assert.equal(privateConfig.plugins[0]?.name, 'panerelay');
    assert.equal(privateConfig.plugins[0]?.command, result.launchPath);

    for (const manifestPath of result.manifestPaths) {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        allowed_origins: string[];
        path: string;
      };
      assert.equal(manifest.path, result.launchPath);
      assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${customExtensionId}/`]);
    }

    await uninstallNativeHost({ homeDirectory, platform: 'linux' });
    const paths = resolveNativeHostInstallationPaths({ homeDirectory, platform: 'linux' });
    await assert.rejects(readFile(paths.hostPath), { code: 'ENOENT' });
    await assert.rejects(readFile(paths.runtimeConfigPath), { code: 'ENOENT' });
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

    await uninstallNativeHost({ dataDirectory, platform: 'win32', registryRunner });
    await uninstallNativeHost({ dataDirectory, platform: 'win32', registryRunner });
    await assert.rejects(readFile(first.hostPath), { code: 'ENOENT' });
    await assert.rejects(readFile(first.launchPath), { code: 'ENOENT' });
    await assert.rejects(readFile(first.manifestPaths[0]!), { code: 'ENOENT' });
    assert.equal(registryCalls.filter(call => call.args[0] === 'add').length, 2);
    assert.equal(registryCalls.filter(call => call.args[0] === 'delete').length, 2);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
