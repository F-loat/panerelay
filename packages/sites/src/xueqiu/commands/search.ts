import { defineCommand } from '@panerelay/site-kit';
import { bounded, percent, pick, required, rows, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Xueqiu stocks by code or name.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Stock code or name.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 10 },
  ],
  output: ['symbol', 'name', 'exchange', 'price', 'changePercent', 'url'],
  examples: ['panerelay xueqiu search 茅台 --limit 10'],
  async run(context, args) {
    const limit = bounded(args.limit, 10, 100);
    const payload = await new XueqiuClient(context).get(
      `https://xueqiu.com/stock/search.json?code=${encodeURIComponent(required(args.query, 'query'))}&size=${limit}`,
    );
    return rows(pick(payload, 'stocks'), 'search')
      .slice(0, limit)
      .map(stock => {
        const exchange = text(pick(stock, 'exchange'));
        const code = text(pick(stock, 'code'));
        const selected =
          ['SH', 'SZ', 'BJ'].includes(exchange) && !code.startsWith(exchange)
            ? `${exchange}${code}`
            : code;
        return {
          symbol: selected,
          name: text(pick(stock, 'name')),
          exchange,
          price: pick(stock, 'current') ?? null,
          changePercent: percent(pick(stock, 'percentage')),
          url: `https://xueqiu.com/S/${selected}`,
        };
      });
  },
});
