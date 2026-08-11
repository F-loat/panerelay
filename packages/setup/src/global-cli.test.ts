import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  GLOBAL_CLI_OWNERSHIP_PROTOCOL,
  GlobalCliLifecycleError,
  globalCliOwnershipPath,
  globalCliPackageSpec,
  installGlobalPanerelayCli,
  uninstallGlobalPanerelayCli,
} from './global-cli.js';

function npmList(version?: string): string {
  return JSON.stringify({
    dependencies: version ? { '@panerelay/cli': { version } } : {},
  });
}

test('builds only exact lockstep CLI package specifications', () => {
  assert.equal(globalCliPackageSpec('0.9.0'), '@panerelay/cli@0.9.0');
  assert.equal(globalCliPackageSpec('0.9.0-beta.42'), '@panerelay/cli@0.9.0-beta.42');
  for (const version of ['latest', '^0.9.0', '0.9.0.1', '../cli']) {
    assert.throws(() => globalCliPackageSpec(version), /exact Panerelay release/);
  }
});

test('installs an absent CLI, records ownership, and skips the matching version', async t => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-global-cli-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(homeDirectory, { force: true, recursive: true });
  });
  const launches: string[][] = [];
  let installedVersion: string | undefined;
  const runner = async (_command: string, args: string[]) => {
    launches.push(args);
    if (args[0] === 'list') {
      return { code: installedVersion ? 0 : 1, stderr: '', stdout: npmList(installedVersion) };
    }
    installedVersion = '0.9.0';
    return { code: 0, stderr: '', stdout: '' };
  };
  const options = {
    cliExecutablePath: false as const,
    homeDirectory,
    packageManager: '/opt/node/bin/npm',
    runner,
  };

  assert.deepEqual(await installGlobalPanerelayCli('0.9.0', options), {
    managed: true,
    operation: 'installed',
    packageSpec: '@panerelay/cli@0.9.0',
    version: '0.9.0',
  });
  assert.deepEqual(JSON.parse(await readFile(globalCliOwnershipPath(homeDirectory), 'utf8')), {
    protocol: GLOBAL_CLI_OWNERSHIP_PROTOCOL,
    version: '0.9.0',
  });
  assert.equal((await installGlobalPanerelayCli('0.9.0', options)).operation, 'current');
  assert.equal(launches.filter(args => args[0] === 'install').length, 1);
});

test('preserves a pre-existing unowned global CLI', async t => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-global-cli-external-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(homeDirectory, { force: true, recursive: true });
  });
  const launches: string[][] = [];
  const result = await installGlobalPanerelayCli('0.9.0', {
    cliExecutablePath: false,
    homeDirectory,
    packageManager: '/opt/node/bin/npm',
    runner: async (_command, args) => {
      launches.push(args);
      return { code: 0, stderr: '', stdout: npmList('0.8.0') };
    },
  });
  assert.deepEqual(result, {
    managed: false,
    operation: 'preserved',
    packageSpec: '@panerelay/cli@0.9.0',
    version: '0.8.0',
  });
  assert.equal(launches.length, 1);
});

test('updates and removes only a CLI whose recorded version is still installed', async t => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-global-cli-managed-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(homeDirectory, { force: true, recursive: true });
  });
  const ownershipPath = globalCliOwnershipPath(homeDirectory);
  await mkdir(join(homeDirectory, '.panerelay'));
  await writeFile(
    ownershipPath,
    `${JSON.stringify({ protocol: GLOBAL_CLI_OWNERSHIP_PROTOCOL, version: '0.8.0' })}\n`,
    { mode: 0o600 },
  );
  let installedVersion: string | undefined = '0.8.0';
  const runner = async (_command: string, args: string[]) => {
    if (args[0] === 'list') {
      return { code: installedVersion ? 0 : 1, stderr: '', stdout: npmList(installedVersion) };
    }
    installedVersion = args[0] === 'install' ? '0.9.0' : undefined;
    return { code: 0, stderr: '', stdout: '' };
  };
  const options = {
    cliExecutablePath: false as const,
    homeDirectory,
    packageManager: '/opt/node/bin/npm',
    runner,
  };

  assert.equal((await installGlobalPanerelayCli('0.9.0', options)).operation, 'updated');
  assert.equal((await uninstallGlobalPanerelayCli(options)).operation, 'removed');
});

test('contains package-manager failures without exposing captured output', async t => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-global-cli-failure-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(homeDirectory, { force: true, recursive: true });
  });
  let call = 0;
  await assert.rejects(
    installGlobalPanerelayCli('0.9.0', {
      cliExecutablePath: false,
      homeDirectory,
      packageManager: '/opt/node/bin/npm',
      runner: async () => {
        call += 1;
        return call === 1
          ? { code: 1, stderr: '', stdout: npmList() }
          : {
              code: 1,
              stderr: 'registry=https://token@example.invalid',
              stdout: 'secret output',
            };
      },
    }),
    (error: unknown) =>
      error instanceof GlobalCliLifecycleError &&
      error.code === 'operation-failed' &&
      !error.message.includes('token') &&
      !error.message.includes('secret'),
  );
});

test('fails closed when npm returns an unrecognized global package manifest', async t => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-global-cli-probe-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(homeDirectory, { force: true, recursive: true });
  });
  let launches = 0;
  await assert.rejects(
    installGlobalPanerelayCli('0.9.0', {
      cliExecutablePath: false,
      homeDirectory,
      packageManager: '/opt/node/bin/npm',
      runner: async () => {
        launches += 1;
        return { code: 0, stderr: '', stdout: '{not-json' };
      },
    }),
    (error: unknown) =>
      error instanceof GlobalCliLifecycleError && error.code === 'operation-failed',
  );
  assert.equal(launches, 1);
});

test('preserves a PATH-visible global command before consulting the current npm prefix', async t => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-global-cli-path-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(homeDirectory, { force: true, recursive: true });
  });
  const launches: string[][] = [];
  const result = await installGlobalPanerelayCli('0.9.0', {
    cliExecutablePath: '/Users/example/.nvm/versions/node/v25/bin/panerelay',
    homeDirectory,
    runner: async (_command, args) => {
      launches.push(args);
      return { code: 0, stderr: '', stdout: 'v0.8.0\n' };
    },
  });
  assert.deepEqual(result, {
    executablePath: '/Users/example/.nvm/versions/node/v25/bin/panerelay',
    managed: false,
    operation: 'preserved',
    packageSpec: '@panerelay/cli@0.9.0',
    version: '0.8.0',
  });
  assert.deepEqual(
    await uninstallGlobalPanerelayCli({
      cliExecutablePath: '/Users/example/.nvm/versions/node/v25/bin/panerelay',
      homeDirectory,
      runner: async (_command, args) => {
        launches.push(args);
        return { code: 0, stderr: '', stdout: 'v0.8.0\n' };
      },
    }),
    {
      executablePath: '/Users/example/.nvm/versions/node/v25/bin/panerelay',
      managed: false,
      operation: 'preserved',
      packageSpec: '@panerelay/cli',
      version: '0.8.0',
    },
  );
  assert.deepEqual(launches, [['--version'], ['--version']]);
});
