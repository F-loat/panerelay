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
      protocol: 'panerelay.fetch-adapter.v3',
      id,
      name: id,
      version,
      description: `${id} commands.`,
      origins: ['https://example.com'],
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

test('installs every built-in source when all is requested', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-all-builtins-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const registryPath = join(root, 'installed', 'registry.json');
  const second = await source(root, 'second');
  const first = await source(root, 'first');
  const installed = await installFetchAdapters(['all'], {
    registryPath,
    builtinSources: { second, first },
  });
  assert.deepEqual(
    installed.map(adapter => adapter.manifest.id),
    ['second', 'first'],
  );
  assert.deepEqual(
    installed.map(adapter => adapter.source),
    [
      { kind: 'builtin', id: 'second', version: '1.0.0' },
      { kind: 'builtin', id: 'first', version: '1.0.0' },
    ],
  );
  assert.deepEqual(
    (await readFetchAdapterRegistry({ registryPath })).adapters.map(adapter => adapter.manifest.id),
    ['first', 'second'],
  );
});

async function sourceSite(root: string, id: string): Promise<string> {
  const directory = join(root, `${id}-site`);
  await mkdir(join(directory, 'commands'), { recursive: true });
  await writeFile(
    join(directory, 'panerelay.site.ts'),
    `import { defineSite } from '@panerelay/site-kit';\nexport default defineSite({ id: ${JSON.stringify(id)}, name: ${JSON.stringify(id)}, version: '1.0.0', description: '${id} source commands.', origins: ['https://example.com'] });\n`,
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

function sourceArchiveEntries(id: string, prefix: string): TarEntry[] {
  return [
    {
      name: `${prefix}/panerelay.site.ts`,
      body: `import { defineSite } from '@panerelay/site-kit';\nexport default defineSite({ id: ${JSON.stringify(id)}, name: ${JSON.stringify(id)}, version: '1.0.0', description: '${id} GitHub commands.', origins: ['https://example.com'] });\n`,
    },
    {
      name: `${prefix}/commands/show.ts`,
      body: `import { defineCommand } from '@panerelay/site-kit';\nexport default defineCommand({ name: 'show', description: 'Show data.', access: 'read', args: [], output: ['id'], examples: ['panerelay ${id} show'], async run() { return { id: ${JSON.stringify(id)} }; } });\n`,
    },
  ];
}

function sourceArchive(id: string, prefix = 'repository-commit'): Buffer {
  return tarArchive(sourceArchiveEntries(id, prefix));
}

function githubFetch(
  archive: Buffer,
  requests: string[],
  sha = '0123456789abcdef0123456789abcdef01234567',
  repository = 'owner/repository',
): (input: string | URL | Request) => Promise<Response> {
  const repositoryApiPath = `/repos/${repository}`;
  return async input => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith(repositoryApiPath)) {
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
    git: false,
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
      git: false,
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

test('prefers git ls-remote for a default branch without cloning or using the API', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-git-default-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requests: string[] = [];
  const gitCalls: string[][] = [];
  const sha = '1111111111111111111111111111111111111111';
  const installed = await installFetchAdapters(['owner/repository'], {
    registryPath: join(root, 'installed', 'registry.json'),
    builtinSources: {},
    apiBaseUrl: 'https://api.test',
    codeloadBaseUrl: 'https://codeload.test',
    git: async args => {
      gitCalls.push(args);
      return `ref: refs/heads/main\tHEAD\n${sha}\tHEAD\n`;
    },
    fetch: githubFetch(sourceArchive('github-site'), requests, sha),
  });
  assert.equal(gitCalls.length, 1);
  assert.deepEqual(gitCalls[0], [
    '-c',
    'credential.helper=',
    '-c',
    'core.askPass=',
    '-c',
    'credential.interactive=never',
    'ls-remote',
    '--exit-code',
    '--symref',
    'https://github.com/owner/repository.git',
    'HEAD',
  ]);
  assert.equal(gitCalls[0]?.includes('clone'), false);
  assert.equal(gitCalls[0]?.includes('checkout'), false);
  assert.equal(requests.length, 1);
  assert.deepEqual(installed[0]?.source, {
    kind: 'github',
    repository: 'owner/repository',
    commit: sha,
  });
});

test('resolves branches before tags and peels annotated tags with git', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-git-refs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const branchSha = '2222222222222222222222222222222222222222';
  const tagObjectSha = '3333333333333333333333333333333333333333';
  const tagCommitSha = '4444444444444444444444444444444444444444';
  const branch = await installFetchAdapters(['github:owner/repository@release'], {
    registryPath: join(root, 'branch', 'registry.json'),
    builtinSources: {},
    codeloadBaseUrl: 'https://codeload.test',
    git: async () =>
      `${tagObjectSha}\trefs/tags/release\n${tagCommitSha}\trefs/tags/release^{}\n${branchSha}\trefs/heads/release\n`,
    fetch: githubFetch(sourceArchive('branch-site'), [], branchSha),
  });
  const branchSource = branch[0]?.source;
  assert.equal(branchSource?.kind, 'github');
  if (branchSource?.kind === 'github') assert.equal(branchSource.commit, branchSha);

  const tag = await installFetchAdapters(['github:owner/repository@v1.0.0'], {
    registryPath: join(root, 'tag', 'registry.json'),
    builtinSources: {},
    codeloadBaseUrl: 'https://codeload.test',
    git: async () => `${tagObjectSha}\trefs/tags/v1.0.0\n${tagCommitSha}\trefs/tags/v1.0.0^{}\n`,
    fetch: githubFetch(sourceArchive('tag-site'), [], tagCommitSha),
  });
  const tagSource = tag[0]?.source;
  assert.equal(tagSource?.kind, 'github');
  if (tagSource?.kind === 'github') assert.equal(tagSource.commit, tagCommitSha);
});

test('uses a supplied full commit directly and falls back to the API only when git is absent', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-git-fallback-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sha = '5555555555555555555555555555555555555555';
  let gitCalls = 0;
  const directRequests: string[] = [];
  const direct = await installFetchAdapters([`github:owner/repository@${sha}`], {
    registryPath: join(root, 'direct', 'registry.json'),
    builtinSources: {},
    codeloadBaseUrl: 'https://codeload.test',
    git: async () => {
      gitCalls += 1;
      throw new Error('unexpected git call');
    },
    fetch: githubFetch(sourceArchive('direct-site'), directRequests, sha),
  });
  assert.equal(gitCalls, 0);
  assert.equal(directRequests.length, 1);
  const directSource = direct[0]?.source;
  assert.equal(directSource?.kind, 'github');
  if (directSource?.kind === 'github') assert.equal(directSource.commit, sha);

  const fallbackRequests: string[] = [];
  const fallback = await installFetchAdapters(['github:owner/repository@main'], {
    registryPath: join(root, 'fallback', 'registry.json'),
    builtinSources: {},
    apiBaseUrl: 'https://api.test',
    codeloadBaseUrl: 'https://codeload.test',
    git: async () => {
      throw Object.assign(new Error('git missing'), { code: 'ENOENT' });
    },
    fetch: githubFetch(sourceArchive('fallback-site'), fallbackRequests, sha),
  });
  assert.equal(fallbackRequests.length, 2);
  const fallbackSource = fallback[0]?.source;
  assert.equal(fallbackSource?.kind, 'github');
  if (fallbackSource?.kind === 'github') assert.equal(fallbackSource.commit, sha);
});

test('sanitizes git ref-resolution failures without falling back to the API', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-git-failure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let requests = 0;
  await assert.rejects(
    installFetchAdapters(['github:owner/repository@main'], {
      registryPath: join(root, 'registry.json'),
      builtinSources: {},
      git: async () => {
        throw new Error('credential secret-value');
      },
      fetch: async () => {
        requests += 1;
        throw new Error('unexpected API request');
      },
    }),
    error => {
      assert.match(String(error), /GitHub Git ref resolution failed: owner\/repository/);
      assert.doesNotMatch(String(error), /secret-value/);
      return true;
    },
  );
  assert.equal(requests, 0);
});

test('resolves a catalog-gated built-in ref alias to the official source directory', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-official-ref-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const requests: string[] = [];
  const registryPath = join(root, 'installed', 'registry.json');
  const installed = await installFetchAdapters(['zhihu@main'], {
    registryPath,
    builtinSources: { zhihu: join(root, 'unused-packaged-zhihu') },
    apiBaseUrl: 'https://api.test',
    codeloadBaseUrl: 'https://codeload.test',
    git: false,
    fetch: githubFetch(
      sourceArchive('zhihu', 'repository-commit/packages/sites/src/zhihu'),
      requests,
      'fedcba9876543210fedcba9876543210fedcba98',
      'F-loat/panerelay',
    ),
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(installed[0]?.source, {
    kind: 'github',
    repository: 'F-loat/panerelay',
    commit: 'fedcba9876543210fedcba9876543210fedcba98',
    ref: 'main',
    subdirectory: 'packages/sites/src/zhihu',
  });
});

test('accepts bounded GitHub global PAX metadata without applying it', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-github-pax-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = tarArchive([
    { name: 'pax_global_header', type: 'g', body: '20 comment=GitHub\n' },
    ...sourceArchiveEntries('github-site', 'repository-commit'),
  ]);
  const installed = await installFetchAdapters(['owner/repository'], {
    registryPath: join(root, 'installed', 'registry.json'),
    builtinSources: {},
    apiBaseUrl: 'https://api.test',
    codeloadBaseUrl: 'https://codeload.test',
    git: false,
    fetch: githubFetch(archive, []),
  });
  assert.equal(installed[0]?.manifest.id, 'github-site');
});

test('resolves one-segment GitHub selectors across every common source path', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-github-common-paths-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidates = [
    'github-site',
    'sites/github-site',
    'adapters/github-site',
    'packages/sites/src/github-site',
    'packages/sites/github-site',
    'src/sites/github-site',
  ];
  for (const [index, candidate] of candidates.entries()) {
    const requests: string[] = [];
    const installed = await installFetchAdapters(['owner/repository#github-site'], {
      registryPath: join(root, `installed-${index}`, 'registry.json'),
      builtinSources: {},
      apiBaseUrl: 'https://api.test',
      codeloadBaseUrl: 'https://codeload.test',
      git: false,
      fetch: githubFetch(sourceArchive('github-site', `repository-commit/${candidate}`), requests),
    });
    assert.equal(requests.length, 3);
    const installedSource = installed[0]?.source;
    assert.equal(installedSource?.kind, 'github');
    if (installedSource?.kind === 'github') {
      assert.equal(installedSource.subdirectory, candidate);
    }
  }
});

test('selects the highest-priority adapter-shaped path when several paths match', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-github-priority-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = tarArchive([
    ...sourceArchiveEntries('highest-priority', 'repository-commit/sites/github-site'),
    ...sourceArchiveEntries('lower-priority', 'repository-commit/packages/sites/src/github-site'),
  ]);
  const installed = await installFetchAdapters(['owner/repository#github-site'], {
    registryPath: join(root, 'installed', 'registry.json'),
    builtinSources: {},
    apiBaseUrl: 'https://api.test',
    codeloadBaseUrl: 'https://codeload.test',
    git: false,
    fetch: githubFetch(archive, []),
  });
  assert.equal(installed[0]?.manifest.id, 'highest-priority');
  const installedSource = installed[0]?.source;
  assert.equal(installedSource?.kind, 'github');
  if (installedSource?.kind === 'github') {
    assert.equal(installedSource.subdirectory, 'sites/github-site');
  }
});

test('fails bounded one-segment GitHub selection without recursive discovery', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-github-no-match-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    installFetchAdapters(['owner/repository#github-site'], {
      registryPath: join(root, 'registry.json'),
      builtinSources: {},
      apiBaseUrl: 'https://api.test',
      codeloadBaseUrl: 'https://codeload.test',
      git: false,
      fetch: githubFetch(
        sourceArchive('github-site', 'repository-commit/nested/elsewhere/github-site'),
        [],
      ),
    }),
    /checked: github-site, sites\/github-site, adapters\/github-site, packages\/sites\/src\/github-site, packages\/sites\/github-site, src\/sites\/github-site/,
  );
});

test('does not use the network for unknown IDs, unknown ref aliases, or missing local paths', async t => {
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
  for (const alias of ['unknown@main', 'unknown@feature/ref']) {
    await assert.rejects(
      installFetchAdapters([alias], {
        registryPath: join(root, 'registry.json'),
        builtinSources: {},
        fetch,
      }),
      /Unknown fetch adapter source/,
    );
  }
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
      git: false,
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
        git: false,
        fetch: githubFetch(archive, []),
      }),
      /unsupported file type|unsafe path|oversized file/,
    );
  }
});

test('keeps GitHub archive entry counts bounded above the current repository size', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-github-entry-limit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = tarArchive(
    Array.from({ length: 4_097 }, (_, index) => ({
      name: `repository-commit/files/${index}.txt`,
    })),
  );
  await assert.rejects(
    installFetchAdapters(['owner/repository'], {
      registryPath: join(root, 'registry.json'),
      builtinSources: {},
      apiBaseUrl: 'https://api.test',
      codeloadBaseUrl: 'https://codeload.test',
      git: false,
      fetch: githubFetch(archive, []),
    }),
    /too many entries/,
  );
});
