import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { PANERELAY_EXTENSION_ID } from '@panerelay/protocol';

function chromeExtensionId(publicKey: string): string {
  const digest = createHash('sha256').update(Buffer.from(publicKey, 'base64')).digest();
  return [...digest.subarray(0, 16)]
    .flatMap(byte => [byte >> 4, byte & 0x0f])
    .map(nibble => String.fromCharCode('a'.charCodeAt(0) + nibble))
    .join('');
}

test('retains the public manifest key that derives the official Extension ID', async () => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), 'manifest.json'), 'utf8')) as {
    key?: string;
  };
  assert.equal(typeof manifest.key, 'string');
  assert.equal(chromeExtensionId(manifest.key!), PANERELAY_EXTENSION_ID);
  assert.equal(PANERELAY_EXTENSION_ID, 'panplnkjlkoceaonlmpdekjphgmbggmi');
});

test('does not request the redundant activeTab permission', async () => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), 'manifest.json'), 'utf8')) as {
    permissions?: string[];
  };
  assert.ok(!manifest.permissions?.includes('activeTab'));
  assert.ok(manifest.permissions?.includes('contextMenus'));
  assert.ok(manifest.permissions?.includes('cookies'));
  assert.ok(manifest.permissions?.includes('declarativeNetRequestWithHostAccess'));
  assert.ok(manifest.permissions?.includes('webNavigation'));
});

test('localizes Extension metadata in English and Simplified Chinese', async () => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), 'manifest.json'), 'utf8')) as {
    action?: { default_title?: string };
    default_locale?: string;
    description?: string;
    name?: string;
  };
  const [english, simplifiedChinese] = await Promise.all(
    ['en', 'zh_CN'].map(async locale => {
      const source = await readFile(
        join(process.cwd(), 'public', '_locales', locale, 'messages.json'),
        'utf8',
      );
      return JSON.parse(source) as Record<string, { message?: string }>;
    }),
  );

  assert.equal(manifest.default_locale, 'en');
  assert.equal(manifest.name, '__MSG_extensionName__');
  assert.equal(manifest.description, '__MSG_extensionDescription__');
  assert.equal(manifest.action?.default_title, '__MSG_actionTitle__');
  for (const messages of [english, simplifiedChinese]) {
    assert.ok(messages.extensionName?.message);
    assert.ok(messages.extensionDescription?.message);
    assert.ok(messages.actionTitle?.message);
    assert.ok(messages.releaseAllControl?.message);
  }
  assert.equal(english.releaseAllControl?.message, 'Release all control');
  assert.equal(simplifiedChinese.releaseAllControl?.message, '全部释放');
  assert.match(
    english.extensionDescription?.message ?? '',
    /one tab or all supported tabs in your existing browser/,
  );
  assert.match(
    simplifiedChinese.extensionDescription?.message ?? '',
    /授权当前标签页或全部受支持网页/,
  );
});
