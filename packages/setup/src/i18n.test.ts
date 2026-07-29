import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLocale, resolveLocale, translate } from './i18n.js';

test('normalizes supported English and Chinese locale variants', () => {
  assert.equal(normalizeLocale('en-US'), 'en');
  assert.equal(normalizeLocale('zh_CN'), 'zh-CN');
  assert.equal(normalizeLocale('zh-Hant-TW'), 'zh-CN');
  assert.equal(normalizeLocale('ja-JP'), undefined);
});

test('resolves explicit, environment, and system locales in order', () => {
  assert.equal(
    resolveLocale({
      environment: { PANERELAY_LANG: 'en' },
      requestedLocale: 'zh-CN',
      systemLocale: 'en-US',
    }),
    'zh-CN',
  );
  assert.equal(
    resolveLocale({
      environment: { PANERELAY_LANG: 'zh-CN' },
      systemLocale: 'en-US',
    }),
    'zh-CN',
  );
  assert.equal(resolveLocale({ environment: {}, systemLocale: 'zh-Hans-CN' }), 'zh-CN');
  assert.equal(resolveLocale({ environment: {}, systemLocale: 'ja-JP' }), 'en');
});

test('formats localized messages with values', () => {
  assert.equal(translate('zh-CN', 'nativeHost', { path: '/tmp/host' }), 'Native Host：/tmp/host');
});
