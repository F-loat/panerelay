import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import {
  acquireNativeHostUpdateLock,
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
const currentReleaseVersion = (
  JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

function nativeHostFixture(release = currentReleaseVersion, output = ''): string {
  return `#!/usr/bin/env node
if (process.argv.includes('--self-check')) {
  process.stdout.write(${JSON.stringify(
    JSON.stringify({ protocol: 'panerelay.relay.v2', release }),
  )});
} else {
  process.stdout.write(${JSON.stringify(output)});
}
`;
}

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

test('serializes target-aware Host updates and releases only the owned lock', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-host-lock-'));
  const lockPath = join(root, 'update.lock');
  try {
    const chrome = await acquireNativeHostUpdateLock(lockPath, '0.8.0-beta.42', {
      pollMs: 10,
      timeoutMs: 1_000,
    });
    let edgeAcquired = false;
    const edgePromise = acquireNativeHostUpdateLock(lockPath, '0.8.0-beta.42', {
      pollMs: 10,
      timeoutMs: 1_000,
    }).then(lease => {
      edgeAcquired = true;
      return lease;
    });
    await delay(40);
    assert.equal(edgeAcquired, false);
    assert.deepEqual(JSON.parse(await readFile(lockPath, 'utf8')), chrome.record);

    await chrome.release();
    const edge = await edgePromise;
    assert.equal(edgeAcquired, true);
    assert.equal(edge.record.targetVersion, '0.8.0-beta.42');
    await edge.release();
    await assert.rejects(readFile(lockPath), { code: 'ENOENT' });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('recovers only an expired dead-owner lock and preserves malformed or live locks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-host-stale-lock-'));
  const lockPath = join(root, 'update.lock');
  try {
    await writeFile(
      lockPath,
      `${JSON.stringify({ pid: 999_999, startedAt: 1, targetVersion: '0.7.0' })}\n`,
      { mode: 0o600 },
    );
    const recovered = await acquireNativeHostUpdateLock(lockPath, '0.8.0', {
      isProcessAlive: () => false,
      now: () => 10_000,
      staleMs: 1_000,
      timeoutMs: 500,
    });
    assert.equal(recovered.record.targetVersion, '0.8.0');
    await recovered.release();

    await writeFile(lockPath, '{"targetVersion":"../../outside"}\n', { mode: 0o600 });
    await assert.rejects(
      acquireNativeHostUpdateLock(lockPath, '0.8.0', {
        isProcessAlive: () => false,
        now: () => 10_000,
      }),
      /lock is malformed/,
    );
    assert.equal(await readFile(lockPath, 'utf8'), '{"targetVersion":"../../outside"}\n');

    await writeFile(
      lockPath,
      `${JSON.stringify({ pid: process.pid, startedAt: 1, targetVersion: '0.7.0' })}\n`,
      { mode: 0o600 },
    );
    await assert.rejects(
      acquireNativeHostUpdateLock(lockPath, '0.8.0', {
        isProcessAlive: () => true,
        now: () => 10_000,
        staleMs: 1_000,
        timeoutMs: 100,
      }),
      /Timed out/,
    );
    assert.equal(
      (JSON.parse(await readFile(lockPath, 'utf8')) as { targetVersion: string }).targetVersion,
      '0.7.0',
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('Native Host setup remains automation-engine neutral', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-base-host-'));
  const homeDirectory = join(root, 'home');
  const binDirectory = join(root, 'bin');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  await mkdir(binDirectory, { recursive: true });
  await writeFile(bundledHostPath, nativeHostFixture());
  try {
    const result = await installNativeHost({
      bundledHostPath,
      environment: { PATH: binDirectory },
      homeDirectory,
      platform: 'linux',
    });
    const runtime = JSON.parse(await readFile(result.runtimeConfigPath, 'utf8')) as Record<
      string,
      unknown
    >;
    assert.equal('agentBrowserPath' in runtime, false);
    assert.equal('agentBrowserConfigPath' in runtime, false);
    assert.ok(Array.isArray(runtime.agentPathEntries));
    assert.ok((runtime.agentPathEntries as string[]).includes(binDirectory));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('installs and removes an isolated Native Messaging host', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-host-'));
  const homeDirectory = join(root, 'home');
  const binDirectory = join(root, 'bin');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  const configuredOpenCodePath = join(root, 'configured tools', 'opencode');
  await mkdir(binDirectory, { recursive: true });
  await mkdir(dirname(configuredOpenCodePath), { recursive: true });
  await writeFile(bundledHostPath, nativeHostFixture(currentReleaseVersion, 'ready'));
  for (const executable of ['claude', 'codex', 'opencode']) {
    const path = join(binDirectory, executable);
    await writeFile(
      path,
      executable === 'claude'
        ? '#!/bin/sh\necho "2.1.0 (Claude Code)"\n'
        : executable === 'opencode'
          ? '#!/bin/sh\necho "1.18.12"\n'
          : '#!/bin/sh\nexit 0\n',
    );
    await chmod(path, 0o755);
  }
  await writeFile(configuredOpenCodePath, '#!/bin/sh\necho "1.18.12"\n');
  await chmod(configuredOpenCodePath, 0o755);

  try {
    const result = await installNativeHost({
      bundledHostPath,
      environment: {
        PANERELAY_OPENCODE_PATH: configuredOpenCodePath,
        PATH: binDirectory,
      },
      extensionId: customExtensionId,
      homeDirectory,
      nodePath: '/test/node',
      platform: 'linux',
    });

    assert.equal(result.codexPath, join(binDirectory, 'codex'));
    assert.equal(result.claudePath, join(binDirectory, 'claude'));
    assert.equal(result.claudeVersion, '2.1.0');
    assert.equal(result.opencodePath, configuredOpenCodePath);
    assert.equal(result.opencodePathSource, 'override');
    assert.equal(result.opencodeVersion, '1.18.12');
    assert.equal(result.launchPath, result.hostPath);
    assert.equal(result.releaseVersion, currentReleaseVersion);
    assert.equal(
      result.selectedHostPath,
      join(result.hostsDirectory, currentReleaseVersion, 'native-host.bundle.cjs'),
    );
    assert.match(await readFile(result.hostPath, 'utf8'), /^#!\/test\/node\n/);
    assert.match(await readFile(result.selectedHostPath, 'utf8'), /^#!\/usr\/bin\/env node\n/);
    assert.equal((await stat(result.hostPath)).mode & 0o777, 0o755);
    assert.equal((await stat(result.currentVersionPath)).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(await readFile(result.currentVersionPath, 'utf8')), {
      version: currentReleaseVersion,
    });
    const launched = spawnSync(process.execPath, [result.hostPath], { encoding: 'utf8' });
    assert.equal(launched.status, 0, launched.stderr);
    assert.equal(launched.stdout, 'ready');

    const runtime = JSON.parse(await readFile(result.runtimeConfigPath, 'utf8')) as {
      codexPath: string;
      claudePath: string;
      claudeVersion: string;
      extensionId: string;
      agentPathEntries: string[];
      opencodePath: string;
      opencodePathSource: string;
      opencodeVersion: string;
    };
    assert.deepEqual(runtime, {
      extensionId: customExtensionId,
      agentPathEntries: ['/test', binDirectory],
      codexPath: result.codexPath,
      claudePath: result.claudePath,
      claudeVersion: '2.1.0',
      opencodePath: result.opencodePath,
      opencodePathSource: 'override',
      opencodeVersion: '1.18.12',
    });

    const updated = await installNativeHost({
      bundledHostPath,
      environment: { PATH: binDirectory },
      homeDirectory,
      nodePath: '/test/node',
      platform: 'linux',
    });
    assert.equal(updated.opencodePath, configuredOpenCodePath);
    assert.equal(updated.opencodePathSource, 'override');
    assert.ok(
      result.manifestPaths.some(path =>
        path.includes(join('.config', 'microsoft-edge', 'NativeMessagingHosts')),
      ),
    );

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
    await assert.rejects(readFile(paths.currentVersionPath), { code: 'ENOENT' });
    await assert.rejects(readFile(result.selectedHostPath), { code: 'ENOENT' });
    for (const manifestPath of paths.manifestPaths) {
      await assert.rejects(readFile(manifestPath), { code: 'ENOENT' });
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('refreshes a legacy persisted OpenCode path from the live setup path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-opencode-migration-'));
  const homeDirectory = join(root, 'home');
  const binDirectory = join(root, 'bin');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  const liveOpenCodePath = join(binDirectory, 'opencode');
  const staleOpenCodePath = join(root, 'stale', 'opencode');
  const paths = resolveNativeHostInstallationPaths({ homeDirectory, platform: 'linux' });
  await mkdir(binDirectory, { recursive: true });
  await mkdir(dirname(staleOpenCodePath), { recursive: true });
  await mkdir(dirname(paths.runtimeConfigPath), { recursive: true });
  await writeFile(bundledHostPath, nativeHostFixture(currentReleaseVersion, 'ready'));
  await writeFile(liveOpenCodePath, '#!/bin/sh\necho "1.18.12"\n');
  await writeFile(staleOpenCodePath, '#!/bin/sh\necho "1.2.27"\n');
  await Promise.all([liveOpenCodePath, staleOpenCodePath].map(filePath => chmod(filePath, 0o755)));
  await writeFile(
    paths.runtimeConfigPath,
    `${JSON.stringify({
      opencodePath: staleOpenCodePath,
      opencodeVersion: '1.2.27',
    })}\n`,
  );
  const probed: string[] = [];

  try {
    const result = await installNativeHost({
      bundledHostPath,
      environment: { PATH: binDirectory },
      homeDirectory,
      platform: 'linux',
      probeRunner: async command => {
        probed.push(command);
        return { code: 0, stderr: '', stdout: '1.18.12' };
      },
    });
    assert.equal(result.opencodePath, liveOpenCodePath);
    assert.equal(result.opencodePathSource, 'discovered');
    assert.deepEqual(probed, [liveOpenCodePath]);
    const runtime = JSON.parse(await readFile(result.runtimeConfigPath, 'utf8')) as Record<
      string,
      unknown
    >;
    assert.equal(runtime.opencodePath, liveOpenCodePath);
    assert.equal(runtime.opencodePathSource, 'discovered');
    assert.equal(runtime.opencodeVersion, '1.18.12');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('commits one validated version pointer and retains only current and previous bundles', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay versioned host-'));
  const homeDirectory = join(root, 'home with spaces');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  try {
    for (const release of ['0.6.0', '0.7.0', '0.8.0-beta.42']) {
      await writeFile(bundledHostPath, nativeHostFixture(release, release));
      const result = await installNativeHost({
        bundledHostPath,
        environment: { PATH: '' },
        expectedReleaseVersion: release,
        homeDirectory,
        platform: 'linux',
      });
      assert.deepEqual(JSON.parse(await readFile(result.currentVersionPath, 'utf8')), {
        version: release,
      });
      const launched = spawnSync(process.execPath, [result.hostPath], { encoding: 'utf8' });
      assert.equal(launched.status, 0, launched.stderr);
      assert.equal(launched.stdout, release);
    }

    const paths = resolveNativeHostInstallationPaths({ homeDirectory, platform: 'linux' });
    await assert.rejects(readFile(join(paths.hostsDirectory, '0.6.0', 'native-host.bundle.cjs')), {
      code: 'ENOENT',
    });
    assert.match(
      await readFile(join(paths.hostsDirectory, '0.7.0', 'native-host.bundle.cjs'), 'utf8'),
      /0\.7\.0/,
    );
    assert.match(
      await readFile(join(paths.hostsDirectory, '0.8.0-beta.42', 'native-host.bundle.cjs'), 'utf8'),
      /0\.8\.0-beta\.42/,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('a failed staged self-check preserves the selected launchable Host', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay host self-check failure-'));
  const homeDirectory = join(root, 'home');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  try {
    await writeFile(bundledHostPath, nativeHostFixture('0.7.0', '0.7.0'));
    const installed = await installNativeHost({
      bundledHostPath,
      environment: { PATH: '' },
      expectedReleaseVersion: '0.7.0',
      homeDirectory,
      platform: 'linux',
    });
    await writeFile(bundledHostPath, nativeHostFixture('0.7.1', 'uncommitted'));
    await assert.rejects(
      installNativeHost({
        bundledHostPath,
        environment: { PATH: '' },
        expectedReleaseVersion: '0.8.0',
        homeDirectory,
        platform: 'linux',
      }),
      /identity does not match setup/,
    );

    assert.deepEqual(JSON.parse(await readFile(installed.currentVersionPath, 'utf8')), {
      version: '0.7.0',
    });
    const launched = spawnSync(process.execPath, [installed.hostPath], { encoding: 'utf8' });
    assert.equal(launched.status, 0, launched.stderr);
    assert.equal(launched.stdout, '0.7.0');
    await assert.rejects(
      readFile(join(installed.hostsDirectory, '0.8.0', 'native-host.bundle.cjs')),
      { code: 'ENOENT' },
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('staging, launcher, and lock failures preserve the committed launchable Host', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay host filesystem failures-'));
  const homeDirectory = join(root, 'home');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  try {
    await writeFile(bundledHostPath, nativeHostFixture('0.7.0', 'committed'));
    const installed = await installNativeHost({
      bundledHostPath,
      environment: { PATH: '' },
      expectedReleaseVersion: '0.7.0',
      homeDirectory,
      platform: 'linux',
    });

    await assert.rejects(
      installNativeHost({
        bundledHostPath: join(root, 'missing.bundle.cjs'),
        environment: { PATH: '' },
        expectedReleaseVersion: '0.8.0',
        homeDirectory,
        platform: 'linux',
      }),
      /ENOENT/,
    );

    await chmod(dirname(installed.hostPath), 0o500);
    try {
      await writeFile(bundledHostPath, nativeHostFixture('0.8.0', 'uncommitted'));
      await assert.rejects(
        installNativeHost({
          bundledHostPath,
          environment: { PATH: '' },
          expectedReleaseVersion: '0.8.0',
          homeDirectory,
          platform: 'linux',
        }),
        /EACCES|permission denied/i,
      );
    } finally {
      await chmod(dirname(installed.hostPath), 0o700);
    }

    await writeFile(installed.updateLockPath, '{"targetVersion":"../../outside"}\n', {
      mode: 0o600,
    });
    await assert.rejects(
      installNativeHost({
        bundledHostPath,
        environment: { PATH: '' },
        expectedReleaseVersion: '0.8.0',
        homeDirectory,
        platform: 'linux',
      }),
      /lock is malformed/,
    );

    assert.deepEqual(JSON.parse(await readFile(installed.currentVersionPath, 'utf8')), {
      version: '0.7.0',
    });
    const launched = spawnSync(process.execPath, [installed.hostPath], { encoding: 'utf8' });
    assert.equal(launched.status, 0, launched.stderr);
    assert.equal(launched.stdout, 'committed');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('registry and pointer-commit failures never select an uncommitted Windows Host', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay windows commit failures-'));
  const dataDirectory = join(root, 'Panerelay Data');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  const successfulRegistry: CommandRunner = async () => ({ code: 0, stderr: '', stdout: '' });
  try {
    await writeFile(bundledHostPath, nativeHostFixture('0.7.0', 'committed'));
    const installed = await installNativeHost({
      bundledHostPath,
      dataDirectory,
      environment: { PATH: '' },
      expectedReleaseVersion: '0.7.0',
      nodePath: process.execPath,
      platform: 'win32',
      registryRunner: successfulRegistry,
    });

    await writeFile(bundledHostPath, nativeHostFixture('0.8.0', 'registry-uncommitted'));
    await assert.rejects(
      installNativeHost({
        bundledHostPath,
        dataDirectory,
        environment: { PATH: '' },
        expectedReleaseVersion: '0.8.0',
        nodePath: process.execPath,
        platform: 'win32',
        registryRunner: async () => ({ code: 5, stderr: 'private registry error', stdout: '' }),
      }),
      /registration failed with code 5/,
    );
    assert.deepEqual(JSON.parse(await readFile(installed.currentVersionPath, 'utf8')), {
      version: '0.7.0',
    });

    await writeFile(bundledHostPath, nativeHostFixture('0.9.0', 'pointer-uncommitted'));
    await assert.rejects(
      installNativeHost({
        bundledHostPath,
        dataDirectory,
        environment: { PATH: '' },
        expectedReleaseVersion: '0.9.0',
        nodePath: process.execPath,
        platform: 'win32',
        registryRunner: async () => {
          await chmod(dataDirectory, 0o500);
          return { code: 0, stderr: '', stdout: '' };
        },
      }),
      /EACCES|permission denied/i,
    );
    await chmod(dataDirectory, 0o700);

    assert.deepEqual(JSON.parse(await readFile(installed.currentVersionPath, 'utf8')), {
      version: '0.7.0',
    });
    const launched = spawnSync(process.execPath, [installed.hostPath], { encoding: 'utf8' });
    assert.equal(launched.status, 0, launched.stderr);
    assert.equal(launched.stdout, 'committed');
  } finally {
    await chmod(dataDirectory, 0o700).catch(() => {});
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
    browser: 'edge',
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
        windowsNativeHostRegistryKey(undefined, 'edge'),
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
  const codexPath = join(root, 'npm wrappers', 'codex.cmd');
  await mkdir(dirname(codexPath), { recursive: true });
  await writeFile(bundledHostPath, nativeHostFixture(currentReleaseVersion, 'ready'));
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
        PANERELAY_CODEX_PATH: codexPath,
      },
      extensionId: customExtensionId,
      nodePath: 'C:\\Program Files\\Node & Tools\\node.exe',
      platform: 'win32',
      registryRunner,
    });
    assert.equal(first.codexPath, codexPath);
    assert.equal(first.launchPath, first.launcherPath);
    assert.match(await readFile(first.launchPath, 'utf8'), /^@echo off\r\n/);
    const launched = spawnSync(process.execPath, [first.hostPath], { encoding: 'utf8' });
    assert.equal(launched.status, 0, launched.stderr);
    assert.equal(launched.stdout, 'ready');
    const manifest = JSON.parse(await readFile(first.manifestPaths[0]!, 'utf8')) as {
      allowed_origins: string[];
      path: string;
    };
    assert.equal(manifest.path, first.launchPath);
    assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${customExtensionId}/`]);
    const updated = await installNativeHost({
      bundledHostPath,
      dataDirectory,
      environment: {
        PANERELAY_CODEX_PATH: codexPath,
      },
      nodePath: 'C:\\Program Files\\Node & Tools\\node.exe',
      platform: 'win32',
      registryRunner,
    });
    assert.equal(updated.extensionId, customExtensionId);

    await uninstallNativeHost({ dataDirectory, platform: 'win32', registryRunner });
    await uninstallNativeHost({ dataDirectory, platform: 'win32', registryRunner });
    await assert.rejects(readFile(first.hostPath), { code: 'ENOENT' });
    await assert.rejects(readFile(first.launchPath), { code: 'ENOENT' });
    await assert.rejects(readFile(first.currentVersionPath), { code: 'ENOENT' });
    await assert.rejects(readFile(first.selectedHostPath), { code: 'ENOENT' });
    await assert.rejects(readFile(first.manifestPaths[0]!), { code: 'ENOENT' });
    assert.equal(registryCalls.filter(call => call.args[0] === 'add').length, 4);
    assert.equal(registryCalls.filter(call => call.args[0] === 'delete').length, 4);
    assert.ok(
      registryCalls.some(call =>
        call.args.includes(windowsNativeHostRegistryKey(undefined, 'edge')),
      ),
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
