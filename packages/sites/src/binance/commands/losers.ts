import { defineCommand } from '@panerelay/site-kit';
import { BinanceClient, bounded, number, text } from '../client.js';
export default defineCommand({
  name: 'losers',
  description: 'Top losing trading pairs.',
  access: 'read',
  args: [{ name: 'limit', description: 'Number of trading pairs', type: 'number', default: 10 }],
  output: ['rank', 'symbol', 'price', 'change24h', 'volume'],
  examples: ['panerelay binance losers'],
  async run(context, args) {
    const rows = (await new BinanceClient(context).json('ticker/24hr')) as unknown[];
    return rows
      .map(item => item as Record<string, unknown>)
      .filter(row => row.priceChangePercent)
      .sort((a, b) => number(a.priceChangePercent) - number(b.priceChangePercent))
      .slice(0, bounded(args.limit, 10, 1000))
      .map((row, index) => ({
        rank: index + 1,
        symbol: text(row.symbol),
        price: text(row.lastPrice),
        change24h: text(row.priceChangePercent),
        volume: text(row.quoteVolume),
      }));
  },
});
