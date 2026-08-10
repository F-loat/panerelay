import { defineCommand } from '@panerelay/site-kit';
import { BlueskyClient, limit, pick, text } from '../client.js';

export default defineCommand({
  name: 'trending',
  description: 'Trending topics on Bluesky.',
  access: 'read',
  args: [{ name: 'limit', description: 'Number of topics', type: 'number', default: 20 }],
  output: ['rank', 'topic', 'link'],
  examples: ['panerelay bluesky trending'],
  async run(context, args) {
    const take = limit(args.limit, 20);
    const body = (await new BlueskyClient(context).json(
      'app.bsky.unspecced.getTrendingTopics',
    )) as { topics?: unknown[] };
    return (body.topics ?? []).slice(0, take).map((item, index) => ({
      rank: index + 1,
      topic: text(pick(item, 'topic')),
      link: text(pick(item, 'link')),
    }));
  },
});
