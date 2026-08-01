import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

test('keeps recent conversations inside their own scroll container', async () => {
  const styles = await readFile(join(process.cwd(), 'src/pages/sidepanel/styles.css'), 'utf8');
  const popover = styles.match(/\.history-popover\s*\{[^}]*\}/)?.[0] ?? '';
  const list = styles.match(/\.history-list\s*\{[^}]*\}/)?.[0] ?? '';

  assert.match(popover, /display: flex/);
  assert.match(popover, /flex-direction: column/);
  assert.match(popover, /max-height:/);
  assert.match(popover, /overflow: hidden/);
  assert.match(list, /min-height: 0/);
  assert.match(list, /overflow-y: auto/);
});
