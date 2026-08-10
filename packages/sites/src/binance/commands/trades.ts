import { defineCommand } from '@panerelay/site-kit';
import { BinanceClient, bounded, required, text } from '../client.js';
export default defineCommand({
  name: 'trades',
  description: 'Recent trades for a trading pair.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Trading pair symbol',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Number of trades', type: 'number', default: 20 },
  ],
  output: ['id', 'price', 'qty', 'quoteQty', 'buyerMaker'],
  examples: ['panerelay binance trades BTCUSDT'],
  async run(context, args) {
    const count = bounded(args.limit, 20, 1000);
    const rows = (await new BinanceClient(context).json('trades', [
      { name: 'symbol', value: required(args.symbol, 'symbol') },
      { name: 'limit', value: count },
    ])) as unknown[];
    return rows.slice(0, count).map(item => {
      const row = item as Record<string, unknown>;
      return {
        id: row.id ?? '',
        price: text(row.price),
        qty: text(row.qty),
        quoteQty: text(row.quoteQty),
        buyerMaker: Boolean(row.isBuyerMaker),
      };
    });
  },
});
