import { defineCommand } from '@panerelay/site-kit';
import { BinanceClient, bounded, number, text } from '../client.js';
export default defineCommand({
  name: 'ticker',
  description: '24h ticker statistics by volume.',
  access: 'read',
  args: [{ name: 'limit', description: 'Number of tickers', type: 'number', default: 20 }],
  output: ['symbol', 'price', 'changePct', 'high', 'low', 'volume', 'quoteVolume', 'trades'],
  examples: ['panerelay binance ticker'],
  async run(context, args) {
    const rows = (await new BinanceClient(context).json('ticker/24hr')) as unknown[];
    return rows
      .map(item => item as Record<string, unknown>)
      .sort((a, b) => number(b.quoteVolume) - number(a.quoteVolume))
      .slice(0, bounded(args.limit, 20, 1000))
      .map(row => ({
        symbol: text(row.symbol),
        price: text(row.lastPrice),
        changePct: text(row.priceChangePercent),
        high: text(row.highPrice),
        low: text(row.lowPrice),
        volume: text(row.volume),
        quoteVolume: text(row.quoteVolume),
        trades: row.count ?? '',
      }));
  },
});
