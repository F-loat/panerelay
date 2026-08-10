import { defineCommand } from '@panerelay/site-kit';
import { bounded, NowCoderClient, pick, selected, text } from '../client.js';
export default defineCommand({
  name: 'hot',
  description: 'List NowCoder hot searches.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 10 }],
  output: ['rank', 'title', 'heat'],
  examples: ['panerelay nowcoder hot --limit 10'],
  async run(context, args) {
    const rows = selected(
      await new NowCoderClient(context).get('hot-search/hot-content'),
      'data',
      'hotQuery',
    );
    return rows.slice(0, bounded(args.limit, 10)).map((item, index) => ({
      rank: pick(item, 'rank') ?? index + 1,
      title: text(pick(item, 'query')),
      heat: pick(item, 'hotValue') ?? 0,
    }));
  },
});
