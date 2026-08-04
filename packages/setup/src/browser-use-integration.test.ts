import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { browserUseGatewayStatePath } from '@panerelay/bridge/browser-use-gateway';
import {
  browserUseEnvironmentPath,
  BROWSER_USE_CHILD_ENVIRONMENT_KEYS,
} from '@panerelay/browser-use';
import { readCliAdapterMode, readCliAdapterRegistry } from '@panerelay/cli';
import {
  installBrowserUseIntegrationArtifacts,
  posixNodeLauncherContent,
  resolveBrowserUseIntegrationPaths,
  uninstallBrowserUseIntegrationArtifacts,
  windowsNodeLauncherContent,
} from './browser-use-integration.js';

test('resolves only the adapter and environment-owned Browser Use paths', () => {
  const unix = resolveBrowserUseIntegrationPaths({
    homeDirectory: '/Users/test',
    platform: 'linux',
  });
  assert.equal(
    unix.adapterArtifactPath,
    '/Users/test/.panerelay/adapters/browser-use/0.2.0/dist/panerelay-browser-use-adapter.mjs',
  );
  assert.equal(
    unix.adapterLauncherPath,
    '/Users/test/.panerelay/bin/panerelay-browser-use-adapter',
  );
  assert.equal('cliLauncherPath' in unix, false);
  assert.equal('mcpLauncherPath' in unix, false);

  const windows = resolveBrowserUseIntegrationPaths({
    homeDirectory: 'C:\\Users\\Test User',
    platform: 'win32',
  });
  assert.equal(
    windows.adapterLauncherPath,
    'C:\\Users\\Test User\\.panerelay\\bin\\panerelay-browser-use-adapter.cmd',
  );
  assert.match(
    windowsNodeLauncherContent('C:\\Program Files\\nodejs\\node.exe', windows.adapterArtifactPath),
    /^@echo off\r\nsetlocal DisableDelayedExpansion\r\n/,
  );
  assert.equal(
    posixNodeLauncherContent('/node path/node', "/user's path/adapter.mjs"),
    String.raw`#!/bin/sh
exec '/node path/node' '/user'"'"'s path/adapter.mjs' "$@"
`,
  );
});

test('installs the official Browser Use integration without private CLI or MCP launchers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-install-'));
  const homeDirectory = join(root, 'home');
  const browserUseExecutable = join(root, 'browser-use');
  const adapterBundlePath = join(root, 'adapter.mjs');
  try {
    await writeFile(browserUseExecutable, '#!/bin/sh\n', { mode: 0o700 });
    await writeFile(adapterBundlePath, 'adapter bundle\n');
    const installation = await installBrowserUseIntegrationArtifacts({
      adapterBundlePath,
      browserUseVersions: {
        browserHarness: '0.1.9',
        browserUse: '0.13.8',
        browserUseExecutable,
      },
      homeDirectory,
    });
    const paths = installation.paths;
    assert.equal(installation.config.browserUseExecutable, browserUseExecutable);
    assert.deepEqual(
      JSON.parse(await readFile(paths.integrationConfigPath, 'utf8')),
      installation.config,
    );
    assert.equal(await readFile(paths.adapterArtifactPath, 'utf8'), 'adapter bundle\n');
    assert.equal(await readCliAdapterMode('browser-use', { homeDirectory }), 'extension');
    assert.equal(
      (await readCliAdapterRegistry({ dataDirectory: paths.dataDirectory, homeDirectory }))
        .adapters[0]?.executablePath,
      paths.adapterLauncherPath,
    );
    const env = await readFile(browserUseEnvironmentPath(homeDirectory), 'utf8');
    assert.match(env, /BU_CDP_URL=/);
    assert.ok(BROWSER_USE_CHILD_ENVIRONMENT_KEYS.every(key => env.includes(key)));
    assert.doesNotMatch(env, /BH_RUNTIME_DIR=/);
    assert.doesNotMatch(env, /BH_TMP_DIR=/);

    const files = await readdir(join(paths.dataDirectory, 'bin'));
    assert.deepEqual(files, ['panerelay-browser-use-adapter']);
    await assert.rejects(readFile(join(paths.dataDirectory, 'bin', 'panerelay-browser-use')), {
      code: 'ENOENT',
    });
    const removed = await uninstallBrowserUseIntegrationArtifacts({ homeDirectory });
    assert.equal(removed.runtimeStateRemoved, false);
    assert.equal(removed.gatewayStop, 'absent');
    await assert.rejects(readFile(paths.adapterLauncherPath), { code: 'ENOENT' });
    await assert.rejects(readFile(browserUseEnvironmentPath(homeDirectory)), { code: 'ENOENT' });
    assert.equal(await readFile(browserUseExecutable, 'utf8'), '#!/bin/sh\n');
    assert.deepEqual(
      (await readCliAdapterRegistry({ dataDirectory: paths.dataDirectory, homeDirectory }))
        .adapters,
      [],
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('stops the owned Browser Use gateway before removing its integration state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-gateway-uninstall-'));
  const homeDirectory = join(root, 'home');
  let stoppedFor: string | undefined;
  try {
    const statePath = browserUseGatewayStatePath(homeDirectory);
    await mkdir(join(statePath, '..'), { recursive: true, mode: 0o700 });
    await writeFile(statePath, '{}');
    const removed = await uninstallBrowserUseIntegrationArtifacts({
      homeDirectory,
      stopGateway: async ({ homeDirectory: selectedHome } = {}) => {
        stoppedFor = selectedHome;
        return 'stopped';
      },
    });
    assert.equal(stoppedFor, homeDirectory);
    assert.equal(removed.gatewayStop, 'stopped');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('treats malformed previous integration config as absent during setup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-malformed-config-'));
  const homeDirectory = join(root, 'home');
  const browserUseExecutable = join(root, 'browser-use');
  const adapterBundlePath = join(root, 'adapter.mjs');
  const paths = resolveBrowserUseIntegrationPaths({ homeDirectory });
  try {
    await mkdir(join(paths.integrationConfigPath, '..'), { recursive: true, mode: 0o700 });
    await writeFile(paths.integrationConfigPath, '{not-json');
    await writeFile(browserUseExecutable, '#!/bin/sh\n', { mode: 0o700 });
    await writeFile(adapterBundlePath, 'adapter bundle\n');
    const installation = await installBrowserUseIntegrationArtifacts({
      adapterBundlePath,
      browserUseVersions: { browserUseExecutable },
      homeDirectory,
    });
    assert.deepEqual(
      JSON.parse(await readFile(paths.integrationConfigPath, 'utf8')),
      installation.config,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('preserves unrelated Browser Harness environment configuration on uninstall', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-environment-'));
  const homeDirectory = join(root, 'home');
  const envPath = browserUseEnvironmentPath(homeDirectory);
  try {
    await mkdir(join(envPath, '..'), { recursive: true });
    await writeFile(envPath, 'CUSTOM_BROWSER_FLAG="keep-me"\n');
    const browserUseExecutable = join(root, 'browser-use');
    await writeFile(browserUseExecutable, '#!/bin/sh\n', { mode: 0o700 });
    await installBrowserUseIntegrationArtifacts({
      browserUseVersions: { browserUseExecutable },
      homeDirectory,
    });
    await uninstallBrowserUseIntegrationArtifacts({ homeDirectory });
    assert.equal(await readFile(envPath, 'utf8'), 'CUSTOM_BROWSER_FLAG="keep-me"\n');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
