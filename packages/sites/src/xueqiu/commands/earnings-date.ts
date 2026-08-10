import { defineCommand } from '@panerelay/site-kit';
import { bounded, chinaDate, pick, rows, symbol, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'earnings-date',
  description: 'List expected earnings publication dates for a stock.',
  access: 'read',
  args: [
    {
      name: 'symbol',
      description: 'Stock symbol.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'next',
      description: 'Return only the next unpublished report.',
      type: 'boolean',
      default: false,
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 10 },
  ],
  output: ['date', 'report', 'status'],
  examples: ['panerelay xueqiu earnings-date SH600519 --next'],
  async run(context, args) {
    const selected = symbol(args.symbol);
    const limit = bounded(args.limit, 10, 100);
    const payload = await new XueqiuClient(context).get(
      `https://stock.xueqiu.com/v5/stock/screener/event/list.json?symbol=${encodeURIComponent(selected)}&page=1&size=100`,
    );
    const items = rows(pick(pick(payload, 'data'), 'items'), 'earnings dates')
      .filter(item => Number(pick(item, 'subtype')) === 2)
      .map(item => {
        const timestamp = Number(pick(item, 'timestamp'));
        return {
          date: chinaDate(timestamp),
          report: text(pick(item, 'message')),
          status: timestamp > Date.now() ? '⏳ 未发布' : '✅ 已发布',
          timestamp,
        };
      });
    const selectedItems = args.next
      ? items
          .filter(item => item.timestamp > Date.now())
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, 1)
      : items.slice(0, limit);
    return selectedItems.map(({ date, report, status }) => ({ date, report, status }));
  },
});
