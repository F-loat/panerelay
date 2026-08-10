import { defineCommand } from '@panerelay/site-kit';
import { bounded, percent, pick, rows, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'watchlist',
  description: 'List stocks in a logged-in Xueqiu watchlist group.',
  access: 'read',
  args: [
    { name: 'pid', description: 'Watchlist group ID.', type: 'string', default: '-1' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 100 },
  ],
  output: ['symbol', 'name', 'price', 'changePercent'],
  examples: ['panerelay xueqiu watchlist --pid -1 --limit 100'],
  async run(context, args) {
    const limit = bounded(args.limit, 100, 100);
    const pid = text(args.pid) || '-1';
    const payload = await new XueqiuClient(context).get(
      `https://stock.xueqiu.com/v5/stock/portfolio/stock/list.json?size=100&category=1&pid=${encodeURIComponent(pid)}`,
    );
    return rows(pick(pick(payload, 'data'), 'stocks'), 'watchlist')
      .slice(0, limit)
      .map(stock => ({
        symbol: text(pick(stock, 'symbol')),
        name: text(pick(stock, 'name')),
        price: pick(stock, 'current') ?? null,
        changePercent: percent(pick(stock, 'percent')),
      }));
  },
});
