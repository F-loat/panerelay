import { defineCommand } from '@panerelay/site-kit';
import { BinanceClient, bounded, text } from '../client.js';
export default defineCommand({
  name: 'prices',
  description: 'Latest prices for all trading pairs.',
  access: 'read',
  args: [{ name: 'limit', description: 'Number of prices', type: 'number', default: 20 }],
  output: ['rank', 'symbol', 'price'],
  examples: ['panerelay binance prices --limit 20'],
  async run(context, args) {
    const rows = (await new BinanceClient(context).json('ticker/price')) as unknown[];
    return rows.slice(0, bounded(args.limit, 20, 1000)).map((item, index) => {
      const row = item as Record<string, unknown>;
      return { rank: index + 1, symbol: text(row.symbol), price: text(row.price) };
    });
  },
});
