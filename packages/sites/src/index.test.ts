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
  assert.deepEqual(builtinSiteIds(), [
    'bilibili',
    'hackernews',
    'arxiv',
    '12306',
    '1point3acres',
    'coingecko',
    'wikipedia',
    'npm',
    'openalex',
    'endoflife',
    'archive',
    'apple-podcasts',
    'bbc',
    'binance',
    'autohome',
    'bluesky',
    'crates',
    'dblp',
    'openreview',
    'defillama',
    'goproxy',
    'dockerhub',
    'osv',
    'packagist',
    'rubygems',
    'pypi',
    'nuget',
    'devto',
    'oeis',
    'flathub',
    'flomo',
    'nvd',
    'openfda',
    'wttr',
    'semanticscholar',
    'rfc',
    'tvmaze',
    'wikidata',
    'pubmed',
    'dictionary',
    'github-trending',
    'homebrew',
    'lobsters',
    'maven',
    'lichess',
    'juejin',
    'mdn',
    'lesswrong',
    'stackoverflow',
    'steam',
    'duckduckgo',
    'google',
    'medium',
    'hf',
    'bloomberg',
    'chess',
    'ths',
    '36kr',
    'v2ex',
    'nowcoder',
    'linux-do',
    'zsxq',
    'xueqiu',
    'reddit',
    'pixiv',
    'boss',
    'zhihu',
    'uisdc',
    'barchart',
    'linkedin-learning',
    'yahoo-finance',
    'huodongxing',
    'weibo',
    'quark',
    'uiverse',
    'reuters',
    'tieba',
    'douban',
    'hupu',
    'google-scholar',
    'github',
    'booking',
    'wanfang',
    'powerchina',
    'maimai',
    'instagram',
    'producthunt',
    'yollomi',
    'ctrip',
    'toutiao',
    'sinafinance',
    'eastmoney',
    'dongchedi',
    'guazi',
    'substack',
    'sinablog',
    'trip',
    'weread',
    'paperreview',
  ]);
  assert.deepEqual(Object.keys(sources).sort(), [...builtinSiteIds()].sort());

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
