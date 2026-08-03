import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  parseCliAdapterResponse,
  serializeCliAdapterMessage,
  type CliAdapterRequest,
} from '@panerelay/protocol';
import {
  readCliAdapterMode,
  readCliAdapterPreferences,
  readCliAdapterRegistry,
  registerCliAdapter,
  PANERELAY_CLI_ADAPTER_PREFERENCES_PATH_ENV,
  PANERELAY_CLI_ADAPTER_REGISTRY_PATH_ENV,
  setCliAdapterMode,
} from '@panerelay/cli';
import {
  installBrowserUseIntegrationArtifacts,
  browserUseLauncherContent,
  posixNodeLauncherContent,
  resolveBrowserUseIntegrationPaths,
  windowsNodeLauncherContent,
  uninstallBrowserUseIntegrationArtifacts,
} from './browser-use-integration.js';

test('resolves private cross-platform Browser Use artifact and launcher paths', () => {
  for (const platform of ['darwin', 'linux'] as const) {
    const unix = resolveBrowserUseIntegrationPaths({ homeDirectory: '/Users/test', platform });
    assert.equal(
      unix.cliArtifactPath,
      '/Users/test/.panerelay/cli/browser-use/0.2.0/dist/panerelay-cli.mjs',
    );
    assert.equal(unix.cliLauncherPath, '/Users/test/.panerelay/bin/panerelay-browser-use');
  }
  const windows = resolveBrowserUseIntegrationPaths({
    homeDirectory: 'C:\\Users\\Test User',
    platform: 'win32',
  });
  assert.equal(
    windows.adapterLauncherPath,
    'C:\\Users\\Test User\\.panerelay\\bin\\panerelay-browser-use-adapter.cmd',
  );
  assert.equal(
    windows.cliArtifactPath,
    'C:\\Users\\Test User\\.panerelay\\cli\\browser-use\\0.2.0\\dist\\panerelay-cli.mjs',
  );
  assert.match(
    windowsNodeLauncherContent('C:\\Program Files\\nodejs\\node.exe', windows.cliArtifactPath),
    /^@echo off\r\nsetlocal DisableDelayedExpansion\r\n"C:\\Program Files/,
  );
  assert.match(
    windowsNodeLauncherContent('C:\\Users\\%USERNAME%\\node.exe', 'C:\\Users\\%USERNAME%\\cli.mjs'),
    /%%USERNAME%%/,
  );
  assert.equal(
    posixNodeLauncherContent('/node path/node', "/user's path/cli.mjs"),
    "#!/bin/sh\nexec '/node path/node' '/user'\"'\"'s path/cli.mjs' \"$@\"\n",
  );
  assert.equal(
    browserUseLauncherContent(
      '/node path/node',
      '/cli.mjs',
      '/browser use/bin/browser-use',
      'darwin',
    ),
    "#!/bin/sh\nif [ \"$#\" -eq 0 ]; then\n  exec '/node path/node' '/cli.mjs' run browser-use -- '/browser use/bin/browser-use'\nfi\nexec '/node path/node' '/cli.mjs' \"$@\"\n",
  );
  assert.match(
    browserUseLauncherContent(
      'C:\\Program Files\\nodejs\\node.exe',
      'C:\\Users\\Test User\\cli.mjs',
      'C:\\Users\\Test User\\browser-use.exe',
      'win32',
    ),
    /if "%\*"=="" goto :no_args\r\n"C:\\Program Files\\nodejs\\node\.exe".*%\*\r\nexit \/b %ERRORLEVEL%\r\n:no_args/s,
  );
});

test('installs protected pinned bundles and preserves unrelated adapter registrations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-install-'));
  const homeDirectory = join(root, 'home');
  const dataDirectory = join(homeDirectory, '.panerelay');
  const unrelatedExecutable = join(dataDirectory, 'bin', 'unrelated-adapter');
  const browserUseExecutable = join(root, 'browser-use');
  try {
    await mkdir(join(dataDirectory, 'bin'), { recursive: true, mode: 0o700 });
    await chmod(dataDirectory, 0o700);
    await writeFile(unrelatedExecutable, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    await writeFile(
      browserUseExecutable,
      '#!/bin/sh\nif [ "$1" = "--cli-mcp" ]; then printf "%s\\n" "$@"; else cat; fi\n',
      {
        mode: 0o700,
      },
    );
    await registerCliAdapter(
      {
        adapterId: 'other-engine',
        version: '1.0.0',
        executablePath: unrelatedExecutable,
        protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
        capabilities: ['connection.resolve'],
        modes: ['direct'],
        childEnvironmentKeys: [],
      },
      { dataDirectory, homeDirectory },
    );

    const installation = await installBrowserUseIntegrationArtifacts({
      browserUseVersions: {
        browserHarness: '0.1.9',
        browserUse: '0.13.8',
        browserUseExecutable,
      },
      homeDirectory,
    });
    const registry = await readCliAdapterRegistry({ dataDirectory, homeDirectory });
    assert.deepEqual(
      registry.adapters.map(adapter => adapter.adapterId),
      ['browser-use', 'other-engine'],
    );
    assert.equal(registry.adapters[0]?.executablePath, installation.paths.adapterLauncherPath);
    assert.equal(await readCliAdapterMode('browser-use', { homeDirectory }), 'extension');
    assert.deepEqual(
      JSON.parse(await readFile(installation.paths.integrationConfigPath, 'utf8')),
      installation.config,
    );
    assert.equal(installation.config.browserUseExecutable, browserUseExecutable);
    assert.equal(installation.config.browserUseVersion, '0.13.8');
    assert.equal(installation.config.browserHarnessVersion, '0.1.9');
    assert.equal(installation.config.mcpLauncherPath, installation.paths.mcpLauncherPath);
    const childEnvironment = {
      ...process.env,
      HOME: homeDirectory,
      USERPROFILE: homeDirectory,
      [PANERELAY_CLI_ADAPTER_PREFERENCES_PATH_ENV]: join(
        dataDirectory,
        'cli-adapter-preferences.json',
      ),
      [PANERELAY_CLI_ADAPTER_REGISTRY_PATH_ENV]: join(dataDirectory, 'cli-adapters.json'),
    };

    const cliBeforeRollback = await readFile(installation.paths.cliArtifactPath);
    await assert.rejects(
      installBrowserUseIntegrationArtifacts({
        browserUseVersions: {
          browserHarness: '0.1.8',
          browserUse: '0.13.7',
          browserUseExecutable,
        },
        homeDirectory,
        registerAdapter: async () => {
          throw new Error('simulated registration failure');
        },
      }),
      /simulated registration failure/,
    );
    assert.deepEqual(await readFile(installation.paths.cliArtifactPath), cliBeforeRollback);
    assert.equal(
      (await readCliAdapterRegistry({ dataDirectory, homeDirectory })).adapters.find(
        adapter => adapter.adapterId === 'browser-use',
      )?.executablePath,
      installation.paths.adapterLauncherPath,
    );

    if (process.platform !== 'win32') {
      assert.equal((await lstat(installation.paths.dataDirectory)).mode & 0o077, 0);
      assert.equal((await lstat(installation.paths.cliArtifactPath)).mode & 0o077, 0);
      assert.equal((await lstat(installation.paths.adapterArtifactPath)).mode & 0o077, 0);
      assert.equal((await lstat(installation.paths.adapterLauncherPath)).mode & 0o077, 0);
      assert.equal((await lstat(installation.paths.mcpLauncherPath)).mode & 0o077, 0);
      assert.equal((await lstat(installation.paths.mcpRunnerArtifactPath)).mode & 0o077, 0);
    }

    const request: CliAdapterRequest = {
      protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
      requestId: 'installed-manifest',
      operation: 'adapter.manifest',
      input: {},
    };
    const result = spawnSync(installation.paths.adapterLauncherPath, [], {
      encoding: 'utf8',
      input: serializeCliAdapterMessage(request),
    });
    assert.equal(result.status, 0, result.stderr);
    const response = parseCliAdapterResponse(result.stdout.trim());
    assert.equal(response.success, true);
    assert.equal(response.operation, 'adapter.manifest');

    const cli = spawnSync(installation.paths.cliLauncherPath, ['--help', '--lang', 'en'], {
      encoding: 'utf8',
      env: childEnvironment,
    });
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /Panerelay CLI/);

    await setCliAdapterMode('browser-use', 'direct', { homeDirectory });
    await installBrowserUseIntegrationArtifacts({
      browserUseDefault: 'direct',
      browserUseVersions: {
        browserHarness: '0.1.9',
        browserUse: '0.13.8',
        browserUseExecutable,
      },
      homeDirectory,
    });
    assert.equal(await readCliAdapterMode('browser-use', { homeDirectory }), 'direct');
    const shorthand = spawnSync(installation.paths.cliLauncherPath, [], {
      encoding: 'utf8',
      env: childEnvironment,
      input: 'print(list_tabs())\n',
    });
    assert.equal(shorthand.status, 0, shorthand.stderr);
    assert.equal(shorthand.stdout, 'print(list_tabs())\n');
    const mcpLauncher = await readFile(installation.paths.mcpLauncherPath, 'utf8');
    assert.match(mcpLauncher, /run browser-use --/);
    assert.match(mcpLauncher, /panerelay-browser-use-mcp-runner\.mjs/);
    assert.equal(mcpLauncher.includes(browserUseExecutable), true);
    const mcp = spawnSync(
      process.execPath,
      [installation.paths.mcpRunnerArtifactPath, browserUseExecutable],
      { encoding: 'utf8' },
    );
    assert.equal(mcp.status, 0, mcp.stderr);
    assert.equal(mcp.stdout, '--cli-mcp\n');
    await setCliAdapterMode('other-engine', 'extension', { homeDirectory });
    await installBrowserUseIntegrationArtifacts({ homeDirectory });
    await assert.rejects(readFile(installation.paths.mcpLauncherPath), { code: 'ENOENT' });
    assert.equal(
      'mcpLauncherPath' in
        JSON.parse(await readFile(installation.paths.integrationConfigPath, 'utf8')),
      false,
    );
    assert.deepEqual((await readCliAdapterPreferences({ homeDirectory })).modes, {
      'browser-use': 'direct',
      'other-engine': 'extension',
    });

    await mkdir(installation.paths.runtimeDirectory, { recursive: true });
    await writeFile(join(installation.paths.runtimeDirectory, 'daemon-state'), 'private-state');
    const removed = await uninstallBrowserUseIntegrationArtifacts({ homeDirectory });
    assert.equal(removed.runtimeStateRemoved, true);
    assert.equal(removed.detachedDaemonMayRemain, true);
    assert.deepEqual(
      (await readCliAdapterRegistry({ dataDirectory, homeDirectory })).adapters.map(
        adapter => adapter.adapterId,
      ),
      ['other-engine'],
    );
    assert.deepEqual((await readCliAdapterPreferences({ homeDirectory })).modes, {
      'other-engine': 'extension',
    });
    await assert.rejects(readFile(installation.paths.integrationConfigPath), { code: 'ENOENT' });
    await assert.rejects(readFile(installation.paths.adapterLauncherPath), { code: 'ENOENT' });
    await assert.rejects(readFile(installation.paths.cliLauncherPath), { code: 'ENOENT' });
    await assert.rejects(readFile(installation.paths.mcpLauncherPath), { code: 'ENOENT' });
    const repeated = await uninstallBrowserUseIntegrationArtifacts({ homeDirectory });
    assert.equal(repeated.runtimeStateRemoved, false);
    assert.equal(repeated.detachedDaemonMayRemain, false);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('rolls back a fresh failed registration and uninstalls partial owned state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-rollback-'));
  const homeDirectory = join(root, 'home');
  const paths = resolveBrowserUseIntegrationPaths({ homeDirectory });
  try {
    await assert.rejects(
      installBrowserUseIntegrationArtifacts({
        homeDirectory,
        browserUseVersions: {
          browserHarness: '0.1.9',
          browserUse: '0.13.8',
          browserUseExecutable: join(root, 'browser-use'),
        },
        registerAdapter: async () => {
          throw new Error('fresh registration failure');
        },
      }),
      /fresh registration failure/,
    );
    for (const filePath of [
      paths.adapterArtifactPath,
      paths.adapterLauncherPath,
      paths.adapterPackagePath,
      paths.cliArtifactPath,
      paths.cliLauncherPath,
      paths.integrationConfigPath,
      paths.mcpLauncherPath,
      paths.mcpRunnerArtifactPath,
    ]) {
      await assert.rejects(readFile(filePath), { code: 'ENOENT' });
    }

    await mkdir(paths.runtimeDirectory, { recursive: true });
    await writeFile(join(paths.runtimeDirectory, 'partial-daemon-state'), 'state');
    await mkdir(join(paths.adapterStorageDirectory, 'old-version'), { recursive: true });
    await writeFile(join(paths.adapterStorageDirectory, 'old-version', 'adapter'), 'old');
    await mkdir(join(paths.cliStorageDirectory, 'old-version'), { recursive: true });
    await writeFile(join(paths.cliStorageDirectory, 'old-version', 'cli'), 'old');
    await mkdir(join(paths.cliLauncherPath, '..'), { recursive: true });
    await writeFile(paths.cliLauncherPath, 'partial');
    const result = await uninstallBrowserUseIntegrationArtifacts({ homeDirectory });
    assert.equal(result.detachedDaemonMayRemain, true);
    assert.equal(result.runtimeStateRemoved, true);
    await assert.rejects(readFile(paths.cliLauncherPath), { code: 'ENOENT' });
    await assert.rejects(readFile(join(paths.adapterStorageDirectory, 'old-version', 'adapter')), {
      code: 'ENOENT',
    });
    await assert.rejects(readFile(join(paths.cliStorageDirectory, 'old-version', 'cli')), {
      code: 'ENOENT',
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('rejects Browser Use integration installation without an executable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-missing-'));
  try {
    await assert.rejects(
      installBrowserUseIntegrationArtifacts({
        homeDirectory: join(root, 'home'),
        browserUseVersions: { browserHarness: '0.1.9', browserUse: '0.13.8' },
      }),
      /Browser Use installation is incomplete/,
    );
    await assert.rejects(
      installBrowserUseIntegrationArtifacts({ homeDirectory: join(root, 'other-home') }),
      /Browser Use installation is incomplete/,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
