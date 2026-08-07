import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
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
          examples: [`panerelay ${id} show`],
        },
      ],
    }),
  );
  return directory;
}

async function sourceSite(root: string, id: string): Promise<string> {
  const directory = join(root, `${id}-site`);
  await mkdir(join(directory, 'commands'), { recursive: true });
  await writeFile(
    join(directory, 'panerelay.site.ts'),
    `import { defineSite } from '@panerelay/site-kit';\nexport default defineSite({ id: ${JSON.stringify(id)}, name: ${JSON.stringify(id)}, version: '1.0.0', description: '${id} source commands.' });\n`,
  );
  await writeFile(
    join(directory, 'commands', 'show.ts'),
    `import { defineCommand } from '@panerelay/site-kit';\nexport default defineCommand({ name: 'show', description: 'Show data.', access: 'read', args: [], output: ['id'], examples: ['panerelay ${id} show'], async run() { return { id: ${JSON.stringify(id)} }; } });\n`,
  );
  return directory;
}

interface TarEntry {
  name: string;
  body?: string;
  type?: string;
  declaredSize?: number;
}

function writeTarText(block: Buffer, offset: number, length: number, value: string): void {
  block.write(value.slice(0, length), offset, length, 'utf8');
}

function tarArchive(entries: TarEntry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? '');
    const header = Buffer.alloc(512);
    writeTarText(header, 0, 100, entry.name);
    writeTarText(header, 100, 8, '0000600\0');
    writeTarText(header, 108, 8, '0000000\0');
    writeTarText(header, 116, 8, '0000000\0');
    writeTarText(
      header,
      124,
      12,
      `${(entry.declaredSize ?? body.length).toString(8).padStart(11, '0')}\0`,
    );
    writeTarText(header, 136, 12, '00000000000\0');
    header.fill(32, 148, 156);
    writeTarText(header, 156, 1, entry.type ?? '0');
    writeTarText(header, 257, 6, 'ustar\0');
    writeTarText(header, 263, 2, '00');
    let checksum = 0;
    for (const byte of header) checksum += byte;
    writeTarText(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

function sourceArchive(id: string, prefix = 'repository-commit'): Buffer {
  return tarArchive([
    {
      name: `${prefix}/panerelay.site.ts`,
      body: `import { defineSite } from '@panerelay/site-kit';\nexport default defineSite({ id: ${JSON.stringify(id)}, name: ${JSON.stringify(id)}, version: '1.0.0', description: '${id} GitHub commands.' });\n`,
    },
    {
      name: `${prefix}/commands/show.ts`,
      body: `import { defineCommand } from '@panerelay/site-kit';\nexport default defineCommand({ name: 'show', description: 'Show data.', access: 'read', args: [], output: ['id'], examples: ['panerelay ${id} show'], async run() { return { id: ${JSON.stringify(id)} }; } });\n`,
    },
  ]);
}

function githubFetch(
  archive: Buffer,
  requests: string[],
  sha = '0123456789abcdef0123456789abcdef01234567',
): (input: string | URL | Request) => Promise<Response> {
  return async input => {
    const url = String(input);
    requests.push(url);
    if (/\/repos\/owner\/repository$/.test(url)) {
      return Response.json({ default_branch: 'main' });
    }
    if (/\/commits\//.test(url)) return Response.json({ sha });
    if (/\/tar\.gz\//.test(url)) return new Response(Uint8Array.from(archive));
    return new Response(null, { status: 404 });
  };
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

test('builds local source-form adapters without running repository package scripts', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryPath = join(root, 'installed', 'registry.json');
  const adapterSource = await sourceSite(root, 'source-site');
  const marker = join(root, 'package-script-ran');
  await writeFile(
    join(adapterSource, 'package.json'),
    JSON.stringify({ scripts: { build: `touch ${marker}` } }),
  );
  const installed = await installFetchAdapters([adapterSource], {
    registryPath,
    builtinSources: {},
  });
  assert.deepEqual(installed[0]?.source, { kind: 'local', path: adapterSource });
  await assert.rejects(stat(marker), /ENOENT/);
  assert.deepEqual((await readdir(join(root, 'installed', 'source-site', '1.0.0'))).sort(), [
    'adapter.mjs',
    'panerelay-fetch-adapter.json',
  ]);
});

test('resolves explicit public GitHub shorthand to one commit and records provenance', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-github-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requests: string[] = [];
  const registryPath = join(root, 'installed', 'registry.json');
  const installed = await installFetchAdapters(['owner/repository'], {
    registryPath,
    builtinSources: {},
    apiBaseUrl: 'https://api.test',
    codeloadBaseUrl: 'https://codeload.test',
    fetch: githubFetch(sourceArchive('github-site'), requests),
  });
  assert.equal(requests.length, 3);
  assert.deepEqual(installed[0]?.source, {
    kind: 'github',
    repository: 'owner/repository',
    commit: '0123456789abcdef0123456789abcdef01234567',
  });
  assert.equal(installed[0]?.manifest.id, 'github-site');
});

test('supports an explicit GitHub ref and adapter subdirectory without resolving a default branch', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-github-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requests: string[] = [];
  const registryPath = join(root, 'installed', 'registry.json');
  const installed = await installFetchAdapters(
    ['github:owner/repository@v1.2.3#sites/github-site'],
    {
      registryPath,
      builtinSources: {},
      apiBaseUrl: 'https://api.test',
      codeloadBaseUrl: 'https://codeload.test',
      fetch: githubFetch(
        sourceArchive('github-site', 'repository-commit/sites/github-site'),
        requests,
      ),
    },
  );
  assert.equal(requests.length, 2);
  assert.deepEqual(installed[0]?.source, {
    kind: 'github',
    repository: 'owner/repository',
    commit: '0123456789abcdef0123456789abcdef01234567',
    ref: 'v1.2.3',
    subdirectory: 'sites/github-site',
  });
});

test('does not use the network for unknown bare IDs or explicit missing local paths', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-no-network-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let requests = 0;
  const fetch = async (): Promise<Response> => {
    requests += 1;
    throw new Error('unexpected request');
  };
  await assert.rejects(
    installFetchAdapters(['unknown'], {
      registryPath: join(root, 'registry.json'),
      builtinSources: {},
      fetch,
    }),
    /Unknown fetch adapter source/,
  );
  await assert.rejects(
    installFetchAdapters(['./missing'], {
      registryPath: join(root, 'registry.json'),
      builtinSources: {},
      fetch,
    }),
    /source directory is unavailable/,
  );
  assert.equal(requests, 0);
});

test('rejects unsafe GitHub archives and keeps mixed batches atomic', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-github-unsafe-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryPath = join(root, 'installed', 'registry.json');
  const local = await source(root, 'local-valid');
  const unsafe = tarArchive([{ name: 'repository-commit/../escape.ts', body: 'escape' }]);
  await assert.rejects(
    installFetchAdapters([local, 'owner/repository'], {
      registryPath,
      builtinSources: {},
      apiBaseUrl: 'https://api.test',
      codeloadBaseUrl: 'https://codeload.test',
      fetch: githubFetch(unsafe, []),
    }),
    /unsafe path/,
  );
  assert.equal((await readFetchAdapterRegistry({ registryPath })).adapters.length, 0);
});

test('rejects GitHub credentials, links, deep paths, and oversized declared files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-github-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryPath = join(root, 'registry.json');
  await assert.rejects(
    installFetchAdapters(['https://user:secret@github.com/owner/repository'], {
      registryPath,
      builtinSources: {},
    }),
    /unsafe/,
  );
  for (const archive of [
    tarArchive([{ name: 'repository-commit/link', type: '2' }]),
    tarArchive([
      { name: `repository-commit/${Array.from({ length: 33 }, () => 'd').join('/')}/file.ts` },
    ]),
    tarArchive([
      {
        name: 'repository-commit/large.ts',
        declaredSize: 8 * 1024 * 1024 + 1,
      },
    ]),
  ]) {
    await assert.rejects(
      installFetchAdapters(['github:owner/repository@main'], {
        registryPath,
        builtinSources: {},
        apiBaseUrl: 'https://api.test',
        codeloadBaseUrl: 'https://codeload.test',
        fetch: githubFetch(archive, []),
      }),
      /unsupported file type|unsafe path|oversized file/,
    );
  }
});
