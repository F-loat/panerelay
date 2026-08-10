import { defineCommand } from '@panerelay/site-kit';
import { BarchartClient, pick, symbol } from '../client.js';

export default defineCommand({
  name: 'quote',
  description: 'Get a Barchart stock quote and key metrics.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Stock ticker.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'symbol',
    'name',
    'price',
    'change',
    'changePct',
    'open',
    'high',
    'low',
    'prevClose',
    'volume',
    'avgVolume',
    'marketCap',
    'peRatio',
    'eps',
  ],
  examples: ['panerelay barchart quote AAPL'],
  async run(context, args) {
    const ticker = symbol(args.symbol);
    const client = new BarchartClient(context);
    await client.seed(`/stocks/quotes/${encodeURIComponent(ticker)}/overview`);
    const fields =
      'symbol,symbolName,lastPrice,priceChange,percentChange,highPrice,lowPrice,openPrice,previousPrice,volume,averageVolume,marketCap,peRatio,earningsPerShare,tradeTime';
    const row =
      (
        await client.api(
          `/proxies/core-api/v1/quotes/get?symbol=${encodeURIComponent(ticker)}&fields=${fields}`,
        )
      )[0] ?? {};
    return [
      {
        symbol: pick(row, 'symbol') ?? ticker,
        name: pick(row, 'symbolName') ?? ticker,
        price: pick(row, 'lastPrice') ?? null,
        change: pick(row, 'priceChange') ?? null,
        changePct: pick(row, 'percentChange') ?? null,
        open: pick(row, 'openPrice') ?? null,
        high: pick(row, 'highPrice') ?? null,
        low: pick(row, 'lowPrice') ?? null,
        prevClose: pick(row, 'previousPrice') ?? null,
        volume: pick(row, 'volume') ?? null,
        avgVolume: pick(row, 'averageVolume') ?? null,
        marketCap: pick(row, 'marketCap') ?? null,
        peRatio: pick(row, 'peRatio') ?? null,
        eps: pick(row, 'earningsPerShare') ?? null,
      },
    ];
  },
});
