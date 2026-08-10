import { defineCommand } from '@panerelay/site-kit';
import { BinanceClient, bounded, text } from '../client.js';
export default defineCommand({
  name: 'pairs',
  description: 'List active Binance trading pairs.',
  access: 'read',
  args: [{ name: 'limit', description: 'Number of trading pairs', type: 'number', default: 20 }],
  output: ['symbol', 'base', 'quote', 'status'],
  examples: ['panerelay binance pairs'],
  async run(context, args) {
    const body = (await new BinanceClient(context).json('exchangeInfo')) as Record<string, unknown>;
    const rows = Array.isArray(body.symbols) ? body.symbols : [];
    return rows
      .filter(item => (item as Record<string, unknown>).status === 'TRADING')
      .slice(0, bounded(args.limit, 20, 1000))
      .map(item => {
        const row = item as Record<string, unknown>;
        return {
          symbol: text(row.symbol),
          base: text(row.baseAsset),
          quote: text(row.quoteAsset),
          status: text(row.status),
        };
      });
  },
});
