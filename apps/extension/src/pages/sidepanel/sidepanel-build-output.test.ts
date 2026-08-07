import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

test('does not emit unusable cross-world module preloads into the side panel', async () => {
  const html = await readFile(join(process.cwd(), 'dist/src/pages/sidepanel/index.html'), 'utf8');

  assert.doesNotMatch(html, /rel=["']modulepreload["']/);
});

test('packages the standalone fetch permission page as an Extension entry', async () => {
  const html = await readFile(
    join(process.cwd(), 'dist/src/pages/fetch-permission/index.html'),
    'utf8',
  );
  const entry = html.match(/src=["']\/assets\/(fetchPermission-[^"']+\.js)["']/)?.[1];

  assert.ok(entry, 'fetch permission HTML should reference its compiled entry');
  assert.doesNotMatch(html, /rel=["']modulepreload["']/);
  const script = await readFile(join(process.cwd(), 'dist/assets', entry!), 'utf8');
  assert.match(script, /panerelay\.fetch-permission\.decision/);
});

test('packages the localized action-menu release entry and its background wiring', async () => {
  const dist = join(process.cwd(), 'dist');
  const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8')) as {
    background?: { service_worker?: string };
    permissions?: string[];
  };
  const [english, simplifiedChinese] = await Promise.all(
    ['en', 'zh_CN'].map(
      async locale =>
        JSON.parse(
          await readFile(join(dist, '_locales', locale, 'messages.json'), 'utf8'),
        ) as Record<string, { message?: string }>,
    ),
  );
  const loader = await readFile(join(dist, manifest.background?.service_worker ?? ''), 'utf8');
  const backgroundEntry = loader.match(/import\s+["']\.\/(.+?)["']/)?.[1];

  assert.ok(manifest.permissions?.includes('contextMenus'));
  assert.ok(manifest.permissions?.includes('cookies'));
  assert.ok(manifest.permissions?.includes('declarativeNetRequestWithHostAccess'));
  assert.equal(english.releaseAllControl?.message, 'Release all control');
  assert.equal(simplifiedChinese.releaseAllControl?.message, '全部释放');
  assert.ok(backgroundEntry, 'service worker loader should import the compiled background entry');
  const background = await readFile(join(dist, backgroundEntry!), 'utf8');
  assert.match(background, /panerelay\.release-all-control/);
  assert.match(background, /contextMenus/);
});
