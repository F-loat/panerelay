import { defineCommand } from '@panerelay/site-kit';
import { BinanceClient, bounded, required, text } from '../client.js';
export default defineCommand({
  name: 'klines',
  description: 'Candlestick data for a trading pair.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Trading pair symbol',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'interval', description: 'Kline interval', type: 'string', default: '1d' },
    { name: 'limit', description: 'Number of klines', type: 'number', default: 10 },
  ],
  output: ['open', 'high', 'low', 'close', 'volume'],
  examples: ['panerelay binance klines BTCUSDT --interval 1d'],
  async run(context, args) {
    const rows = (await new BinanceClient(context).json('klines', [
      { name: 'symbol', value: required(args.symbol, 'symbol') },
      { name: 'interval', value: text(args.interval) || '1d' },
      { name: 'limit', value: bounded(args.limit, 10, 1000) },
    ])) as unknown[];
    return rows.map(item => {
      const row = item as unknown[];
      return {
        open: text(row[1]),
        high: text(row[2]),
        low: text(row[3]),
        close: text(row[4]),
        volume: text(row[5]),
      };
    });
  },
});
