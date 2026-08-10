import { defineCommand } from '@panerelay/site-kit';
import { hotRow, limit, pick, ToutiaoClient } from '../client.js';
export default defineCommand({
  name: 'hot',
  description: 'List the public Toutiao hot board.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum topics.', type: 'number', default: 30 }],
  output: ['rank', 'group_id', 'title', 'query', 'hot_value', 'label', 'url', 'image_url'],
  examples: ['panerelay toutiao hot --limit 10'],
  async run(context, args) {
    const body = await new ToutiaoClient(context).get(
      'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
    );
    const data = pick(body, 'data');
    if (!Array.isArray(data)) throw new Error('toutiao hot returned malformed data');
    const rows = data
      .map((item, index) => hotRow(item as Record<string, unknown>, index + 1))
      .filter(Boolean)
      .slice(0, limit(args.limit, 30));
    if (!rows.length) throw new Error('toutiao hot returned no topics');
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  },
});
