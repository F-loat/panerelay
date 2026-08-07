import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { builtinSiteIds, builtinSiteSources } from './index.js';

test('catalog exposes every built-in adapter as a valid two-file source', async () => {
  const catalogPackage = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version?: string };
  const sources = builtinSiteSources();
  assert.deepEqual(builtinSiteIds(), ['bilibili']);
  assert.deepEqual(Object.keys(sources), ['bilibili']);

  for (const [id, directory] of Object.entries(sources)) {
    assert.deepEqual((await readdir(directory)).sort(), [
      'adapter.mjs',
      'panerelay-fetch-adapter.json',
    ]);
    const manifest = JSON.parse(
      await readFile(join(directory, 'panerelay-fetch-adapter.json'), 'utf8'),
    ) as { id?: string; entry?: string; version?: string };
    assert.equal(manifest.id, id);
    assert.equal(manifest.entry, 'adapter.mjs');
    assert.equal(manifest.version, catalogPackage.version);
    assert.ok((await stat(join(directory, 'adapter.mjs'))).size > 0);
  }
});
