import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

test('keeps external control status, activity, gap, and release in one compact section', async () => {
  const directory = join(process.cwd(), 'src/pages/sidepanel');
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  const css = await readFile(join(directory, 'styles.css'), 'utf8');
  const source = await readFile(join(directory, 'index.ts'), 'utf8');

  assert.match(html, /data-external-control/);
  assert.match(html, /data-control-actor/);
  assert.match(html, /data-control-gap/);
  assert.match(html, /data-external-activities/);
  assert.match(html, /data-control-release/);
  assert.ok(
    html.indexOf('data-external-control') > html.indexOf('data-browser-scope') &&
      html.indexOf('data-external-control') < html.indexOf('</aside>'),
  );
  assert.ok(html.indexOf('data-external-control') < html.indexOf('data-chat-scroll'));
  assert.match(css, /\.external-control/);
  assert.match(css, /var\(--surface\)/);
  assert.equal(source.match(/externalControl: /g)?.length, 2);
  assert.equal(source.match(/activityHistoryGap: /g)?.length, 2);
});
