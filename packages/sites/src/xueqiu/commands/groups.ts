import { defineCommand } from '@panerelay/site-kit';
import { pick, rows, text, XueqiuClient } from '../client.js';

export default defineCommand({
  name: 'groups',
  description: 'List logged-in Xueqiu watchlist groups and simulated portfolios.',
  access: 'read',
  args: [],
  output: ['pid', 'name', 'count'],
  examples: ['panerelay xueqiu groups'],
  async run(context) {
    const payload = await new XueqiuClient(context).get(
      'https://stock.xueqiu.com/v5/stock/portfolio/list.json?category=1&size=20',
    );
    return rows(pick(pick(payload, 'data'), 'stocks'), 'groups').map(group => ({
      pid: text(pick(group, 'id')),
      name: text(pick(group, 'name')),
      count: pick(group, 'symbol_count') ?? 0,
    }));
  },
});
