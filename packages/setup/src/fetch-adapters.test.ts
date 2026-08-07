import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readFetchAdapterRegistry } from '@panerelay/cli';
import { installFetchAdapters, removeFetchAdapters } from './fetch-adapters.js';

test('installs the packaged Bilibili adapter only when explicitly requested', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-builtin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryPath = join(root, 'fetch-adapters', 'registry.json');
  const installed = await installFetchAdapters(['bilibili'], { registryPath });
  assert.equal(installed[0]?.manifest.id, 'bilibili');
  assert.equal((await readFetchAdapterRegistry({ registryPath })).adapters.length, 1);
});

async function source(root: string, id: string, version = '1.0.0'): Promise<string> {
  const directory = join(root, `${id}-source`);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'adapter.mjs'), 'process.stdout.write("adapter")');
  await writeFile(
    join(directory, 'panerelay-fetch-adapter.json'),
    JSON.stringify({
      protocol: 'panerelay.fetch-adapter.v1',
      id,
      name: id,
      version,
      description: `${id} commands.`,
      entry: 'adapter.mjs',
      commands: [
        {
          name: 'show',
          description: 'Show data.',
          access: 'read',
          args: [],
          output: ['id'],
          examples: [`panerelay fetch ${id} show`],
        },
      ],
    }),
  );
  return directory;
}

test('installs a validated batch atomically with protected files and removes targets independently', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-install-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryPath = join(root, 'installed', 'registry.json');
  const first = await source(root, 'first');
  const second = await source(root, 'second');
  const installed = await installFetchAdapters([first, second], {
    registryPath,
    builtinSources: {},
  });
  assert.deepEqual(
    installed.map(value => value.manifest.id),
    ['first', 'second'],
  );
  const registry = await readFetchAdapterRegistry({ registryPath, verifyExecutables: true });
  assert.equal(registry.adapters.length, 2);
  if (process.platform !== 'win32') {
    assert.equal((await stat(registryPath)).mode & 0o777, 0o600);
    assert.equal((await stat(installed[0]!.executablePath)).mode & 0o777, 0o600);
  }

  assert.deepEqual(await removeFetchAdapters(['first'], { registryPath }), ['first']);
  assert.deepEqual(
    (await readFetchAdapterRegistry({ registryPath })).adapters.map(value => value.manifest.id),
    ['second'],
  );
  assert.deepEqual(await removeFetchAdapters('all', { registryPath }), ['second']);
  assert.equal((await readFetchAdapterRegistry({ registryPath })).adapters.length, 0);
});

test('validates every source before making a batch visible', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-install-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryPath = join(root, 'installed', 'registry.json');
  const valid = await source(root, 'valid');
  const invalid = await source(root, 'invalid');
  await writeFile(join(invalid, 'panerelay-fetch-adapter.json'), '{broken');
  await assert.rejects(
    installFetchAdapters([valid, invalid], { registryPath, builtinSources: {} }),
    /not valid JSON/,
  );
  assert.equal((await readFetchAdapterRegistry({ registryPath })).adapters.length, 0);
});

test('rejects symlink-like or over-permissioned installed registry state', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-install-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryPath = join(root, 'installed', 'registry.json');
  const adapterSource = await source(root, 'fixture');
  await installFetchAdapters([adapterSource], { registryPath, builtinSources: {} });
  if (process.platform !== 'win32') {
    await chmod(registryPath, 0o644);
    await assert.rejects(removeFetchAdapters('all', { registryPath }), /0600/);
  }
  assert.match(await readFile(join(adapterSource, 'adapter.mjs'), 'utf8'), /adapter/);
});
