import { defineCommand } from '@panerelay/site-kit';
import { BinanceClient, bounded, required, text } from '../client.js';
export default defineCommand({
  name: 'depth',
  description: 'Order book bid and ask prices.',
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
  output: ['rank', 'bidPrice', 'bidQty', 'askPrice', 'askQty'],
  examples: ['panerelay binance depth BTCUSDT'],
  async run(context, args) {
    const body = (await new BinanceClient(context).json('depth', [
      { name: 'symbol', value: required(args.symbol, 'symbol') },
      { name: 'limit', value: bounded(args.limit, 10, 100) },
    ])) as Record<string, unknown>;
    const bids = Array.isArray(body.bids) ? body.bids : [];
    const asks = Array.isArray(body.asks) ? body.asks : [];
    return bids.slice(0, bounded(args.limit, 10, 100)).map((bid, index) => {
      const b = bid as unknown[];
      const a = (asks[index] ?? []) as unknown[];
      return {
        rank: index + 1,
        bidPrice: text(b[0]),
        bidQty: text(b[1]),
        askPrice: text(a[0]),
        askQty: text(a[1]),
      };
    });
  },
});
