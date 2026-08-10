import { defineCommand } from '@panerelay/site-kit';
import { BinanceClient, bounded, number, text } from '../client.js';
export default defineCommand({
  name: 'top',
  description: 'Top trading pairs by 24h volume.',
  access: 'read',
  args: [{ name: 'limit', description: 'Number of trading pairs', type: 'number', default: 20 }],
  output: ['rank', 'symbol', 'price', 'change24h', 'high', 'low', 'volume'],
  examples: ['panerelay binance top'],
  async run(context, args) {
    const rows = (await new BinanceClient(context).json('ticker/24hr')) as unknown[];
    return rows
      .map(item => item as Record<string, unknown>)
      .sort((a, b) => number(b.quoteVolume) - number(a.quoteVolume))
      .slice(0, bounded(args.limit, 20, 1000))
      .map((row, index) => ({
        rank: index + 1,
        symbol: text(row.symbol),
        price: text(row.lastPrice),
        change24h: text(row.priceChangePercent),
        high: text(row.highPrice),
        low: text(row.lowPrice),
        volume: text(row.quoteVolume),
      }));
  },
});
