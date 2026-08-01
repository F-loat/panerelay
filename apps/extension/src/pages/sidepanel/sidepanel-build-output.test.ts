import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

test('does not emit unusable cross-world module preloads into the side panel', async () => {
  const html = await readFile(join(process.cwd(), 'dist/src/pages/sidepanel/index.html'), 'utf8');

  assert.doesNotMatch(html, /rel=["']modulepreload["']/);
});
