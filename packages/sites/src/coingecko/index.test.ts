import assert from 'node:assert/strict';
import test from 'node:test';
import coin from './commands/coin.js';
import top from './commands/top.js';
import trending from './commands/trending.js';
import categories from './commands/categories.js';
import derivatives from './commands/derivatives.js';
import exchanges from './commands/exchanges.js';
import global from './commands/global.js';

const bitcoin = {
  id: 'bitcoin',
  symbol: 'btc',
  name: 'Bitcoin',
  market_cap_rank: 1,
  market_data: {
    current_price: { usd: 100 },
    market_cap: { usd: 200 },
    total_volume: { usd: 30 },
    price_change_percentage_24h: 1,
    ath: { usd: 120 },
    ath_date: { usd: '2024-01-02T00:00:00Z' },
  },
  genesis_date: '2009-01-03',
  links: { homepage: ['https://bitcoin.org'] },
};

function context(body: unknown, urls: string[]) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'coingecko',
      operation: 'execute' as const,
      command: 'coin',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string }) => {
      urls.push(request.url);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body,
        bodyType: 'json' as const,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}

test('CoinGecko commands map OpenCLI-compatible public JSON endpoints', async () => {
  const urls: string[] = [];
  assert.equal(
    (
      (await coin.run(context(bitcoin, urls), { id: 'bitcoin', currency: 'usd' })) as Array<{
        symbol: string;
      }>
    )[0]?.symbol,
    'BTC',
  );
  assert.equal(
    (
      (await top.run(
        context([{ market_cap_rank: 1, symbol: 'btc', name: 'Bitcoin', current_price: 100 }], urls),
        { currency: 'usd', limit: 1 },
      )) as Array<{ rank: number }>
    )[0]?.rank,
    1,
  );
  assert.equal(
    (
      (await trending.run(
        context(
          { coins: [{ item: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', price_btc: 1 } }] },
          urls,
        ),
      )) as Array<{ id: string }>
    )[0]?.id,
    'bitcoin',
  );
  assert.equal(
    (
      (await categories.run(context([{ id: 'defi', name: 'DeFi' }], urls), { limit: 1 })) as Array<{
        id: string;
      }>
    )[0]?.id,
    'defi',
  );
  assert.equal(
    (
      (await derivatives.run(context([{ market: 'demo', symbol: 'BTCUSDT' }], urls), {
        limit: 1,
      })) as Array<{ symbol: string }>
    )[0]?.symbol,
    'BTCUSDT',
  );
  assert.equal(
    (
      (await exchanges.run(context([{ id: 'demo', name: 'Demo' }], urls), {
        limit: 1,
        page: 1,
      })) as Array<{ id: string }>
    )[0]?.id,
    'demo',
  );
  assert.equal(
    (
      (await global.run(
        context({ data: { total_market_cap: { usd: 1 }, total_volume: { usd: 2 } } }, urls),
        { currency: 'usd' },
      )) as Array<{ currency: string }>
    )[0]?.currency,
    'USD',
  );
  assert.ok(urls.some(url => url.endsWith('/coins/bitcoin')));
  assert.ok(urls.some(url => url.endsWith('/global')));
});
