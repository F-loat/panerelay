import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { builtinSiteIds, builtinSiteSources } from './index.js';

test('catalog exposes every built-in adapter as a valid two-file source', async () => {
  const catalogPackage = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version?: string };
  const ids = builtinSiteIds();
  const sources = builtinSiteSources();
  assert.equal(ids.length, 99);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.slice(0, 5), ['bilibili', 'hackernews', 'arxiv', '12306', '1point3acres']);
  assert.deepEqual(ids.slice(-5), ['substack', 'sinablog', 'trip', 'weread', 'paperreview']);
  assert.ok(ids.includes('36kr'));
  assert.deepEqual(Object.keys(sources).sort(), [...ids].sort());
  assert.deepEqual((await readdir(dirname(sources[ids[0]!]))).sort(), [...ids].sort());

  for (const [id, directory] of Object.entries(sources)) {
    assert.deepEqual((await readdir(directory)).sort(), [
      'adapter.mjs',
      'panerelay-fetch-adapter.json',
    ]);
    const manifest = JSON.parse(
      await readFile(join(directory, 'panerelay-fetch-adapter.json'), 'utf8'),
    ) as {
      id?: string;
      entry?: string;
      version?: string;
      origins?: string[];
      commands?: Array<{ name?: string; access?: string }>;
    };
    assert.equal(manifest.id, id);
    assert.equal(manifest.entry, 'adapter.mjs');
    assert.equal(manifest.version, catalogPackage.version);
    assert.ok((await stat(join(directory, 'adapter.mjs'))).size > 0);
    if (id === 'zhihu') {
      assert.deepEqual(manifest.origins, ['https://www.zhihu.com', 'https://zhuanlan.zhihu.com']);
      const commandAccess = Object.fromEntries(
        (manifest.commands ?? []).map(command => [command.name, command.access]),
      );
      assert.equal(commandAccess['article-create'], 'write');
      assert.equal(commandAccess['article-draft'], 'read');
      assert.equal(commandAccess['article-update'], 'write');
      assert.equal(commandAccess['article-delete'], 'write');
      assert.equal(commandAccess['article-publish'], undefined);
      assert.equal(commandAccess['comment-update'], undefined);
      assert.equal(commandAccess['comment-delete'], 'write');
    }
  }
});
