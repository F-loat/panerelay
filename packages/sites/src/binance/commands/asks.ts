import { defineCommand } from '@panerelay/site-kit';
import { BinanceClient, bounded, required, text } from '../client.js';
export default defineCommand({
  name: 'asks',
  description: 'Order book ask prices.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Trading pair symbol',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Number of price levels', type: 'number', default: 10 },
  ],
  output: ['rank', 'askPrice', 'askQty'],
  examples: ['panerelay binance asks BTCUSDT'],
  async run(context, args) {
    const count = bounded(args.limit, 10, 100);
    const body = (await new BinanceClient(context).json('depth', [
      { name: 'symbol', value: required(args.symbol, 'symbol') },
      { name: 'limit', value: count },
    ])) as Record<string, unknown>;
    return (Array.isArray(body.asks) ? body.asks : []).slice(0, count).map((item, index) => {
      const row = item as unknown[];
      return { rank: index + 1, askPrice: text(row[0]), askQty: text(row[1]) };
    });
  },
});
