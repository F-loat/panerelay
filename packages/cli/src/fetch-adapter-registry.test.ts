import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readFetchAdapterRegistry } from './fetch-adapter-registry.js';

async function fixture(): Promise<{ root: string; registryPath: string; entry: string }> {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-registry-'));
  const entry = join(root, 'bilibili', '0.8.0', 'adapter.mjs');
  await mkdir(join(root, 'bilibili', '0.8.0'), { recursive: true, mode: 0o700 });
  await writeFile(entry, 'process.stdout.write("ok")', { mode: 0o600 });
  const registryPath = join(root, 'registry.json');
  await writeFile(
    registryPath,
    `${JSON.stringify({
      protocol: 'panerelay.fetch-adapter-registry.v3',
      adapters: [
        {
          manifest: {
            protocol: 'panerelay.fetch-adapter.v3',
            id: 'bilibili',
            name: 'Bilibili',
            version: '0.8.0',
            description: 'Bilibili commands.',
            origins: ['https://api.bilibili.com'],
            entry: 'adapter.mjs',
            commands: [
              {
                name: 'me',
                description: 'Current profile.',
                access: 'read',
                args: [],
                output: ['uid'],
                examples: ['panerelay bilibili me'],
              },
            ],
          },
          executablePath: entry,
          sha256: createHash('sha256')
            .update(await readFile(entry))
            .digest('hex'),
        },
      ],
    })}\n`,
    { mode: 0o600 },
  );
  return { root, registryPath, entry };
}

test('reads a protected registry and verifies executable containment and digest', async t => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  const registry = await readFetchAdapterRegistry({
    registryPath: value.registryPath,
    verifyExecutables: true,
  });
  assert.equal(registry.adapters[0]?.manifest.id, 'bilibili');
});

test('rejects writable registry files and executable symlinks', async t => {
  const writable = await fixture();
  t.after(() => rm(writable.root, { recursive: true, force: true }));
  if (process.platform !== 'win32') {
    await chmod(writable.registryPath, 0o644);
    await assert.rejects(readFetchAdapterRegistry({ registryPath: writable.registryPath }), /0600/);
  }

  const linked = await fixture();
  t.after(() => rm(linked.root, { recursive: true, force: true }));
  const target = `${linked.entry}.target`;
  await writeFile(target, 'process.stdout.write("ok")', { mode: 0o600 });
  await rm(linked.entry);
  await symlink(target, linked.entry);
  await assert.rejects(
    readFetchAdapterRegistry({ registryPath: linked.registryPath, verifyExecutables: true }),
    /regular file/,
  );
});
