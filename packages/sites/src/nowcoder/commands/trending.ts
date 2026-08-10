import { defineCommand } from '@panerelay/site-kit';
import { bounded, NowCoderClient, pick, selected, text } from '../client.js';
export default defineCommand({
  name: 'trending',
  description: 'List trending NowCoder posts.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 10 }],
  output: ['rank', 'title', 'heat', 'id'],
  examples: ['panerelay nowcoder trending --limit 10'],
  async run(context, args) {
    return selected(
      await new NowCoderClient(context).get('hot-search/top-hot-pc'),
      'data',
      'result',
    )
      .slice(0, bounded(args.limit, 10))
      .map((item, index) => ({
        rank: index + 1,
        title: text(pick(item, 'title')),
        heat: pick(item, 'hotValueFromDolphin') ?? 0,
        id: pick(item, 'uuid') ?? pick(item, 'id') ?? '',
      }));
  },
});
