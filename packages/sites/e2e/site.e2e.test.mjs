import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { builtinSiteIds } from '../dist/index.js';

const execFileAsync = promisify(execFile);
const cli = new URL('../../cli/dist/cli.js', import.meta.url);
const enabled = process.env.PANERELAY_RUN_SITE_E2E === '1';
const requestedSites = (process.env.PANERELAY_E2E_SITES ?? '')
  .split(',')
  .map(site => site.trim())
  .filter(Boolean);

function dateFromToday(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const rawCases = [
  ['bilibili', 'whoami', [], ['logged_in', 'site']],
  ['bilibili', 'me', [], ['name', 'uid']],
  ['bilibili', 'video', ['BV1GJ411x7h7'], ['field', 'value']],
  ['bilibili', 'search', ['browser'], ['rank', 'title']],
  ['bilibili', 'hot', [], ['rank', 'title']],
  ['bilibili', 'ranking', [], ['rank', 'title']],
  ['bilibili', 'dynamic', [], ['id', 'author']],
  ['bilibili', 'feed', [], ['rank', 'title']],
  ['bilibili', 'feed-detail', ['9001'], ['field', 'value']],
  ['bilibili', 'favorite', [], ['rank', 'title']],
  ['bilibili', 'history', [], ['rank', 'title']],
  ['bilibili', 'following', ['2'], ['mid', 'name']],
  ['bilibili', 'user-videos', ['2'], ['rank', 'title']],
  ['bilibili', 'comments', ['BV1GJ411x7h7'], ['rank', 'text']],
  ['bilibili', 'subtitle', ['BV1GJ411x7h7', '--lang', 'zh-CN'], ['index', 'content']],
  ['bilibili', 'summary', ['BV1GJ411x7h7'], ['time', 'content']],
  ['arxiv', 'search', ['help', '--limit', '3'], ['id', 'title']],
  ['arxiv', 'recent', ['cs.CL', '--limit', '3'], ['id', 'title']],
  ['arxiv', 'paper', ['1706.03762'], ['id', 'title', 'abstract', 'pdf']],
  ['arxiv', 'author', ['Yoshua Bengio', '--limit', '3'], ['id', 'title']],
  ['hackernews', 'top', ['--limit', '3'], ['rank', 'id', 'title']],
  ['hackernews', 'best', ['--limit', '3'], ['rank', 'id', 'title']],
  ['hackernews', 'ask', ['--limit', '3'], ['rank', 'id', 'title']],
  ['hackernews', 'new', ['--limit', '3'], ['rank', 'id', 'title']],
  ['hackernews', 'show', ['--limit', '3'], ['rank', 'id', 'title']],
  ['hackernews', 'jobs', ['--limit', '3'], ['rank', 'id', 'title']],
  ['hackernews', 'search', ['browser', '--limit', '3'], ['rank', 'id', 'title']],
  ['hackernews', 'user', ['pg'], ['username', 'karma']],
  ['hackernews', 'read', ['1', '--limit', '3'], ['type', 'text']],
  ['12306', 'stations', ['shanghai', '--limit', '3'], ['name', 'code']],
  ['1point3acres', 'hot', ['--limit', '3'], ['rank', 'tid', 'title']],
  ['coingecko', 'trending', [], ['id', 'name', 'symbol']],
  ['wikipedia', 'search', ['transformer', '--lang', 'en', '--limit', '3'], ['title']],
  ['npm', 'package', ['react'], ['name', 'latestVersion']],
  ['openalex', 'search', ['transformer', '--limit', '3'], ['rank', 'id', 'title']],
  ['endoflife', 'product', ['nodejs'], ['product', 'cycle', 'eolStatus']],
  ['archive', 'search', ['open source', '--limit', '3'], ['rank', 'identifier', 'title']],
  ['apple-podcasts', 'search', ['technology', '--limit', '3'], ['id', 'title']],
  ['bbc', 'news', ['--limit', '3'], ['rank', 'title', 'url']],
  ['binance', 'price', ['BTCUSDT'], ['symbol', 'price']],
  ['autohome', 'brand', ['宝马', '--limit', '3'], ['seriesId', 'name']],
  ['bluesky', 'profile', ['bsky.app'], ['handle', 'name']],
  ['crates', 'crate', ['serde'], ['name', 'latestVersion']],
  ['dblp', 'search', ['attention', '--limit', '3'], ['rank', 'key', 'title']],
  ['openreview', 'search', ['transformer', '--limit', '3'], ['rank', 'id', 'title']],
  ['defillama', 'protocols', ['--limit', '3'], ['rank', 'slug', 'name']],
  ['goproxy', 'module', ['github.com/gin-gonic/gin'], ['module', 'version']],
  ['dockerhub', 'image', ['nginx'], ['image', 'description']],
  [
    'osv',
    'query',
    ['lodash', '--ecosystem', 'npm', '--version', '4.17.20', '--limit', '3'],
    ['rank', 'id', 'summary'],
  ],
  ['packagist', 'package', ['symfony/console'], ['package', 'version']],
  ['rubygems', 'gem', ['rails'], ['gem', 'version']],
  ['pypi', 'package', ['requests'], ['name', 'latestVersion']],
  ['nuget', 'package', ['Newtonsoft.Json'], ['rank', 'id', 'version']],
  ['devto', 'top', ['--limit', '3'], ['rank', 'id', 'title']],
  ['oeis', 'sequence', ['A000045'], ['id', 'name']],
  ['flathub', 'app', ['org.mozilla.firefox'], ['appId', 'name']],
  ['nvd', 'cve', ['CVE-2021-44228'], ['id', 'severity']],
  ['openfda', 'drug-label', ['aspirin', '--limit', '3'], ['rank', 'id', 'brandName']],
  ['wttr', 'current', ['Tokyo'], ['location', 'country', 'tempC']],
  [
    'semanticscholar',
    'search',
    ['attention is all you need', '--limit', '3'],
    ['rank', 'paperId', 'title'],
  ],
  ['rfc', 'rfc', ['9000'], ['rfc', 'title']],
  ['tvmaze', 'search', ['breaking bad', '--limit', '3'], ['rank', 'id', 'name']],
  [
    'wikidata',
    'search',
    ['einstein', '--language', 'en', '--limit', '3'],
    ['rank', 'qid', 'label'],
  ],
  ['pubmed', 'search', ['transformer', '--limit', '3'], ['rank', 'pmid', 'title']],
  ['dictionary', 'search', ['serendipity'], ['word', 'definition']],
  ['github-trending', 'repos', ['--limit', '3'], ['rank', 'repo', 'url']],
  ['homebrew', 'formula', ['wget'], ['formula', 'version']],
  ['lobsters', 'hot', ['--limit', '3'], ['rank', 'id', 'title']],
  ['maven', 'search', ['junit', '--limit', '3'], ['rank', 'coordinate', 'latestVersion']],
  ['lichess', 'top', ['--perf', 'blitz', '--limit', '3'], ['rank', 'username', 'rating']],
  ['juejin', 'hot', ['--limit', '3'], ['rank', 'article_id', 'title']],
  ['juejin', 'recommend', ['--limit', '3'], ['rank', 'article_id', 'title']],
  ['mdn', 'search', ['fetch', '--limit', '3'], ['rank', 'title', 'url']],
  ['lesswrong', 'frontpage', ['--limit', '3'], ['rank', 'title', 'url']],
  ['stackoverflow', 'hot', ['--limit', '3'], ['rank', 'id', 'title']],
  ['stackoverflow', 'search', ['browser', '--limit', '3'], ['rank', 'id', 'title']],
  ['steam', 'app', ['620'], ['id', 'name', 'url']],
  ['steam', 'search', ['portal', '--limit', '3'], ['rank', 'id', 'name']],
  ['duckduckgo', 'suggest', ['browser', '--limit', '3'], ['phrase']],
  ['google', 'suggest', ['browser'], ['suggestion']],
  ['google', 'news', ['AI', '--limit', '3'], ['title', 'source', 'date', 'url']],
  ['google', 'trends', ['--region', 'US', '--limit', '3'], ['title', 'traffic', 'date']],
  ['medium', 'tag', ['programming', '--limit', '3'], ['rank', 'title', 'url']],
  ['hf', 'models', ['--limit', '3'], ['rank', 'id', 'url']],
  ['hf', 'datasets', ['--limit', '3'], ['rank', 'id', 'url']],
  ['hf', 'paper', ['1706.03762'], ['id', 'title', 'url']],
  ['bloomberg', 'feeds', [], ['name', 'url']],
  ['bloomberg', 'main', ['--limit', '3'], ['rank', 'title', 'link']],
  ['bloomberg', 'crypto', ['--limit', '3'], ['rank', 'title', 'link']],
  ['chess', 'stats', ['magnuscarlsen'], ['kind', 'rating_current']],
  ['chess', 'games', ['magnuscarlsen', '--limit', '1'], ['date', 'url']],
  [
    'chess',
    'game',
    ['https://www.chess.com/game/live/168842570216'],
    ['kind', 'game_id', 'white', 'black', 'result'],
  ],
  ['ths', 'hot-rank', ['--limit', '3'], ['rank', 'name']],
  ['36kr', 'news', ['--limit', '3'], ['rank', 'title', 'url']],
  ['v2ex', 'hot', ['--limit', '3'], ['id', 'rank', 'title']],
  ['nowcoder', 'hot', ['--limit', '3'], ['rank', 'title', 'heat']],
  ['producthunt', 'posts', ['--limit', '3'], ['rank', 'name', 'url']],
  ['yollomi', 'models', ['--type', 'image'], ['type', 'model', 'credits']],
  ['ctrip', 'search', ['苏州', '--limit', '3'], ['rank', 'id', 'name']],
  ['toutiao', 'hot', ['--limit', '3'], ['rank', 'group_id', 'title']],
  ['sinafinance', 'news', ['--limit', '3'], ['id', 'time', 'content']],
  [
    'sinafinance',
    'stock',
    ['AAPL', '--market', 'us'],
    ['Symbol', 'Name', 'Price', 'ChangePercent'],
  ],
  ['eastmoney', 'rank', ['--limit', '3'], ['rank', 'code', 'name']],
  ['dongchedi', 'search', ['宝马X5', '--limit', '3'], ['rank', 'seriesId', 'name']],
  ['guazi', 'browse', ['bj', '--limit', '3'], ['rank', 'clueId', 'title']],
  ['substack', 'search', ['AI', '--limit', '3'], ['rank', 'title', 'url']],
  ['sinablog', 'search', ['徐小明', '--limit', '3'], ['rank', 'title', 'url']],
  ['trip', 'search', ['Tokyo', '--limit', '3'], ['rank', 'name', 'type']],
  ['weread', 'ranking', ['all', '--limit', '3'], ['rank', 'title', 'bookId']],
  ['paperreview', 'review', ['panerelay-e2e-invalid-token'], []],
  ['barchart', 'quote', ['AAPL'], ['symbol', 'name', 'price']],
  [
    'booking',
    'search',
    ['Tokyo', '--checkin', dateFromToday(30), '--checkout', dateFromToday(32), '--limit', '3'],
    ['rank', 'name', 'url'],
  ],
  ['boss', 'search', ['前端', '--city', '杭州', '--limit', '3'], ['name', 'company', 'url']],
  ['douban', 'whoami', [], ['logged_in', 'site']],
  ['github', 'whoami', [], ['logged_in', 'site']],
  ['google-scholar', 'search', ['transformers', '--limit', '3'], ['rank', 'title', 'url']],
  ['huodongxing', 'events', ['--tag', 'AI', '--limit', '3'], ['rank', 'id', 'title']],
  ['hupu', 'hot', ['--limit', '3'], ['rank', 'tid', 'title']],
  ['instagram', 'profile', ['instagram'], ['username', 'name', 'url']],
  ['linkedin-learning', 'trending', ['--limit', '3'], ['rank', 'title', 'url']],
  ['linux-do', 'feed', ['--view', 'latest', '--limit', '3'], ['title', 'replies', 'url']],
  ['maimai', 'whoami', [], ['logged_in', 'site']],
  ['flomo', 'memos', ['--limit', '3'], ['id', 'content', 'updated_at']],
  ['pixiv', 'ranking', ['--mode', 'daily', '--limit', '3'], ['rank', 'title', 'url']],
  ['powerchina', 'search', ['采购', '--limit', '3'], ['rank', 'title', 'url']],
  ['quark', 'whoami', [], ['logged_in', 'site']],
  ['reddit', 'popular', ['--limit', '3'], ['rank', 'id', 'title']],
  ['reuters', 'search', ['markets', '--limit', '3'], ['rank', 'title', 'url']],
  ['tieba', 'hot', ['--limit', '3'], ['rank', 'title', 'url']],
  ['uisdc', 'news', ['--limit', '3'], ['rank', 'title', 'url']],
  [
    'uiverse',
    'code',
    ['cssbuttons-io/fancy-button', '--target', 'css'],
    ['target', 'username', 'code'],
  ],
  ['wanfang', 'search', ['人工智能', '--limit', '3'], ['rank', 'title', 'url']],
  ['weibo', 'hot', ['--limit', '3'], ['rank', 'word', 'url']],
  ['xueqiu', 'hot-stock', ['--limit', '3'], ['rank', 'symbol', 'name']],
  ['yahoo-finance', 'quote', ['AAPL'], ['symbol', 'name', 'price']],
  ['zhihu', 'hot', ['--limit', '3'], ['rank', 'title', 'heat']],
  ['zsxq', 'whoami', [], ['user_id', 'name']],
];

const requiredAuthentication = new Set([
  'bilibili/me',
  'bilibili/dynamic',
  'bilibili/feed',
  'bilibili/feed-detail',
  'bilibili/favorite',
  'bilibili/history',
  'bilibili/following',
  'maimai/whoami',
  'flomo/memos',
  'quark/whoami',
  'zsxq/whoami',
]);
const optionalAuthentication = new Set(['bilibili/whoami', 'douban/whoami', 'github/whoami']);
const expectedBlockers = new Map([
  ['bilibili/summary', ['empty-result']],
  ['bloomberg/main', ['upstream']],
  ['bloomberg/crypto', ['upstream']],
  ['paperreview/review', ['empty-result']],
  ['booking/search', ['challenge', 'upstream']],
  ['huodongxing/events', ['upstream', 'empty-result']],
  ['linkedin-learning/trending', ['authentication', 'empty-result', 'upstream']],
  ['maimai/whoami', ['authentication', 'response-shape']],
  ['uisdc/news', ['response-shape']],
  ['uiverse/code', ['response-shape', 'upstream']],
]);

const cases = rawCases.map(([site, command, positional, fields]) => {
  const key = `${site}/${command}`;
  return {
    site,
    command,
    positional,
    fields,
    authentication: requiredAuthentication.has(key)
      ? 'required'
      : optionalAuthentication.has(key)
        ? 'optional'
        : 'public',
    ...(expectedBlockers.has(key) ? { expectedBlockers: expectedBlockers.get(key) } : {}),
  };
});

const availableSites = new Set(cases.map(({ site }) => site));
const missingBuiltinSites = builtinSiteIds().filter(site => !availableSites.has(site));
if (missingBuiltinSites.length > 0) {
  throw new Error(`Built-in site(s) without E2E coverage: ${missingBuiltinSites.join(', ')}`);
}
const unknownSites = requestedSites.filter(site => !availableSites.has(site));
if (unknownSites.length > 0) {
  throw new Error(
    `Unknown E2E site(s): ${unknownSites.join(', ')}. Available sites: ${[...availableSites].join(', ')}`,
  );
}

const selectedCases =
  requestedSites.length === 0 ? cases : cases.filter(({ site }) => requestedSites.includes(site));

async function runCli(site, command, positional) {
  return execFileAsync(
    process.execPath,
    [cli.pathname, 'fetch', site, command, ...positional, '--json'],
    { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
  );
}

function blockerFrom(error) {
  const detail = String(error?.stderr ?? error);
  const code =
    /\[(auth-required|missing-credential|challenge-required|upstream-failure|shape-drift|empty-result|unsupported)\]/.exec(
      detail,
    )?.[1];
  if (code === 'auth-required' || code === 'missing-credential') return 'authentication';
  if (code === 'challenge-required') return 'challenge';
  if (code === 'upstream-failure') return 'upstream';
  if (code === 'shape-drift') return 'response-shape';
  if (code === 'empty-result') return 'empty-result';
  if (code === 'unsupported') return 'unsupported';
  return undefined;
}

for (const {
  site,
  command,
  positional,
  fields,
  authentication,
  expectedBlockers,
} of selectedCases) {
  test(
    `${site}/${command} executes through the installed Panerelay CLI (${authentication})`,
    { skip: !enabled, concurrency: false },
    async testContext => {
      let actualPositional = positional;
      if (site === 'bilibili' && command === 'feed-detail') {
        const dynamic = JSON.parse((await runCli(site, 'dynamic', [])).stdout);
        const dynamicRow = (Array.isArray(dynamic) ? dynamic : [dynamic])[0];
        assert.ok(dynamicRow?.id, 'bilibili/dynamic returned no usable dynamic id');
        actualPositional = [String(dynamicRow.id)];
      }
      if (site === 'chess' && command === 'game') {
        const games = JSON.parse(
          (await runCli(site, 'games', ['magnuscarlsen', '--limit', '1'])).stdout,
        );
        const gameRow = (Array.isArray(games) ? games : [games])[0];
        assert.ok(gameRow?.url, 'chess/games returned no usable game URL');
        actualPositional = [String(gameRow.url)];
      }

      let stdout;
      let stderr;
      try {
        ({ stdout, stderr } = await runCli(site, command, actualPositional));
      } catch (error) {
        const blocker = blockerFrom(error);
        if (expectedBlockers?.includes(blocker)) {
          testContext.skip(`${site}/${command} reached expected ${blocker} blocker`);
          return;
        }
        if (authentication === 'required' && blocker === 'authentication') {
          testContext.skip(`${site}/${command} requires an authenticated browser session`);
          return;
        }
        throw error;
      }
      assert.equal(stderr, '');
      const result = JSON.parse(stdout);
      const rows = Array.isArray(result) ? result : [result];
      if (site !== 'bilibili' || command !== 'history') {
        assert.ok(rows.length > 0, `${site}/${command} returned no rows`);
      }
      if (rows.length > 0) {
        for (const field of fields)
          assert.ok(field in rows[0], `${site}/${command} misses ${field}`);
      }
    },
  );
}
