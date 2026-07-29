import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  installNativeHost,
  nativeHostManifestPaths,
  resolveNativeHostInstallationPaths,
  uninstallNativeHost,
} from './host-installation.js';

test('fails clearly on unsupported Native Messaging platforms', () => {
  assert.throws(
    () => nativeHostManifestPaths({ platform: 'win32' }),
    /Native Messaging installation is not implemented for win32/,
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
    await writeFile(path, '#!/bin/sh\nexit 0\n');
    await chmod(path, 0o755);
  }

  try {
    const result = await installNativeHost({
      bundledHostPath,
      environment: { PATH: binDirectory },
      extensionId: 'extension-test',
      homeDirectory,
      nodePath: '/test/node',
      platform: 'linux',
    });

    assert.equal(result.agentBrowserPath, join(binDirectory, 'agent-browser'));
    assert.equal(result.codexPath, join(binDirectory, 'codex'));
    assert.match(await readFile(result.hostPath, 'utf8'), /^#!\/test\/node\n/);
    assert.equal((await stat(result.hostPath)).mode & 0o777, 0o755);

    const runtime = JSON.parse(await readFile(result.runtimeConfigPath, 'utf8')) as {
      agentBrowserConfigPath: string;
      agentBrowserPath: string;
      codexPath: string;
    };
    assert.deepEqual(runtime, {
      agentBrowserConfigPath: result.agentBrowserConfigPath,
      agentBrowserPath: result.agentBrowserPath,
      codexPath: result.codexPath,
    });
    const privateConfig = JSON.parse(await readFile(result.agentBrowserConfigPath, 'utf8')) as {
      plugins: Array<{ command: string; name: string }>;
    };
    assert.equal(privateConfig.plugins[0]?.name, 'panerelay');
    assert.equal(privateConfig.plugins[0]?.command, result.hostPath);

    for (const manifestPath of result.manifestPaths) {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        allowed_origins: string[];
        path: string;
      };
      assert.equal(manifest.path, result.hostPath);
      assert.deepEqual(manifest.allowed_origins, ['chrome-extension://extension-test/']);
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
