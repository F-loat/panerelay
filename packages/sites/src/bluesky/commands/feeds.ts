import { defineCommand } from '@panerelay/site-kit';
import { BlueskyClient, limit, pick, text } from '../client.js';

export default defineCommand({
  name: 'feeds',
  description: 'Popular Bluesky feed generators.',
  access: 'read',
  args: [{ name: 'limit', description: 'Number of feeds', type: 'number', default: 20 }],
  output: ['rank', 'name', 'likes', 'creator', 'description'],
  examples: ['panerelay bluesky feeds'],
  async run(context, args) {
    const take = limit(args.limit, 20);
    const body = (await new BlueskyClient(context).json(
      'app.bsky.unspecced.getPopularFeedGenerators',
      { limit: take },
    )) as { feeds?: unknown[] };
    return (body.feeds ?? []).slice(0, take).map((item, index) => ({
      rank: index + 1,
      name: text(pick(item, 'displayName')),
      likes: pick(item, 'likeCount') ?? null,
      creator: text(pick(item, 'creator.handle')),
      description: text(pick(item, 'description')),
    }));
  },
});
