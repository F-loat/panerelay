import { defineCommand } from '@panerelay/site-kit';
import { bounded, percent, pick, rows, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'hot-stock',
  description: 'List hot stocks on Xueqiu.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
    {
      name: 'type',
      description: 'Ranking type: 10 popularity, 12 followers.',
      type: 'string',
      default: '10',
    },
  ],
  output: ['rank', 'symbol', 'name', 'price', 'changePercent', 'heat'],
  examples: ['panerelay xueqiu hot-stock --type 10 --limit 20'],
  async run(context, args) {
    const limit = bounded(args.limit, 20, 50);
    const type = text(args.type) || '10';
    const payload = await new XueqiuClient(context).get(
      `https://stock.xueqiu.com/v5/stock/hot_stock/list.json?size=${limit}&type=${encodeURIComponent(type)}`,
    );
    return rows(pick(pick(payload, 'data'), 'items'), 'hot stocks').map((stock, index) => ({
      rank: index + 1,
      symbol: text(pick(stock, 'symbol')),
      name: text(pick(stock, 'name')),
      price: pick(stock, 'current') ?? null,
      changePercent: percent(pick(stock, 'percent')),
      heat: pick(stock, 'value') ?? 0,
    }));
  },
});
