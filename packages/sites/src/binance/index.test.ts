import assert from 'node:assert/strict';
import test from 'node:test';
import gainers from './commands/gainers.js';
import depth from './commands/depth.js';
import klines from './commands/klines.js';
import price from './commands/price.js';

function context(
  body: unknown,
  requests: Array<{ url: string; query?: { name: string; value: string }[] }>,
) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'binance',
      operation: 'execute' as const,
      command: 'price',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: { name: string; value: string }[] }) => {
      requests.push(request);
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

test('Binance commands map public market data', async () => {
  const requests: Array<{ url: string; query?: { name: string; value: string }[] }> = [];
  const priceResult = await price.run(
    context(
      {
        symbol: 'BTCUSDT',
        lastPrice: '100',
        priceChange: '2',
        priceChangePercent: '2',
        highPrice: '101',
        lowPrice: '98',
        volume: '10',
        quoteVolume: '1000',
        count: 4,
      },
      requests,
    ),
    { symbol: 'btcusdt' },
  );
  assert.equal((priceResult as Array<{ symbol: string }>)[0]?.symbol, 'BTCUSDT');
  const gainResult = await gainers.run(
    context(
      [
        { symbol: 'A', priceChangePercent: '-1', quoteVolume: '1', lastPrice: '1' },
        { symbol: 'B', priceChangePercent: '3', quoteVolume: '2', lastPrice: '2' },
      ],
      requests,
    ),
    { limit: 1 },
  );
  assert.equal((gainResult as Array<{ symbol: string }>)[0]?.symbol, 'B');
  const depthResult = await depth.run(
    context({ bids: [['100', '2']], asks: [['101', '3']] }, requests),
    { symbol: 'BTCUSDT', limit: 1 },
  );
  assert.equal((depthResult as Array<{ askPrice: string }>)[0]?.askPrice, '101');
  const klineResult = await klines.run(context([[123, '1', '2', '0', '1.5', '10']], requests), {
    symbol: 'BTCUSDT',
    limit: 1,
  });
  assert.equal((klineResult as Array<{ close: string }>)[0]?.close, '1.5');
  assert.ok(requests.some(request => request.url.endsWith('/ticker/24hr')));
  assert.ok(requests.some(request => request.url.endsWith('/depth')));
  assert.ok(requests.some(request => request.url.endsWith('/klines')));
});

test('Binance validates required symbols', async () => {
  await assert.rejects(() => price.run(context({}, []), { symbol: '' }), /symbol is required/);
});
