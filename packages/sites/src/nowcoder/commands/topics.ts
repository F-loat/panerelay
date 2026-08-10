import { defineCommand } from '@panerelay/site-kit';
import { bounded, NowCoderClient, pick, selected, text } from '../client.js';
export default defineCommand({
  name: 'topics',
  description: 'List hot NowCoder discussion topics.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 10 }],
  output: ['rank', 'topic', 'views', 'posts', 'heat', 'id'],
  examples: ['panerelay nowcoder topics --limit 10'],
  async run(context, args) {
    return selected(await new NowCoderClient(context).get('subject/hot-subject'), 'data', 'result')
      .slice(0, bounded(args.limit, 10))
      .map((item, index) => ({
        rank: index + 1,
        topic: text(pick(item, 'content')),
        views: pick(item, 'viewCount') ?? 0,
        posts: pick(item, 'momentCount') ?? 0,
        heat: pick(item, 'hotValue') ?? 0,
        id: pick(item, 'uuid') ?? pick(item, 'id') ?? '',
      }));
  },
});
