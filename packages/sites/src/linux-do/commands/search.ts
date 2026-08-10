import { defineCommand } from '@panerelay/site-kit';
import { bounded, LinuxDoClient, object, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Linux.do topics.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'views', 'likes', 'replies', 'url'],
  examples: ['panerelay linux-do search Panerelay --limit 20'],
  async run(context, args) {
    const limit = bounded(args.limit, 20, 100);
    const raw = pick(
      await new LinuxDoClient(context).get(
        `/search.json?q=${encodeURIComponent(required(args.query, 'query'))}`,
      ),
      'topics',
    );
    if (!Array.isArray(raw)) throw new Error('linux-do search response is malformed');
    return raw.slice(0, limit).map((value, index) => {
      const topic = object(value);
      return {
        rank: index + 1,
        title: text(pick(topic, 'title')),
        views: pick(topic, 'views') ?? 0,
        likes: pick(topic, 'like_count') ?? 0,
        replies: Math.max(0, Number(pick(topic, 'posts_count') ?? 1) - 1),
        url: `https://linux.do/t/topic/${text(pick(topic, 'id'))}`,
      };
    });
  },
});
