import { defineCommand } from '@panerelay/site-kit';
import { amount, object, percent, pick, rows, symbol, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'stock',
  description: 'Get a real-time Xueqiu stock quote.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Stock symbol.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['name', 'symbol', 'price', 'changePercent', 'marketCap'],
  examples: ['panerelay xueqiu stock SH600519'],
  async run(context, args) {
    const selected = symbol(args.symbol);
    const payload = await new XueqiuClient(context).get(
      `https://stock.xueqiu.com/v5/stock/batch/quote.json?symbol=${encodeURIComponent(selected)}`,
    );
    const item = rows(pick(pick(payload, 'data'), 'items'), 'quote')[0];
    if (!item) throw new Error(`xueqiu found no quote for ${selected}`);
    const quote = object(pick(item, 'quote'));
    return [
      {
        name: text(pick(quote, 'name')),
        symbol: text(pick(quote, 'symbol')),
        price: pick(quote, 'current') ?? null,
        changePercent: percent(pick(quote, 'percent')),
        marketCap: amount(pick(quote, 'market_capital')),
      },
    ];
  },
});
