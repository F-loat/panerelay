import { defineCommand } from '@panerelay/site-kit';
import { bounded, listing, postRow, RedditClient, username } from '../client.js';

export default defineCommand({
  name: 'user-posts',
  description: "List a Reddit user's submitted posts.",
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Reddit username.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 15 },
  ],
  output: ['title', 'subreddit', 'score', 'comments', 'url'],
  examples: ['panerelay reddit user-posts spez --limit 15'],
  async run(context, args) {
    const limit = bounded(args.limit, 15, 100);
    return listing(
      await new RedditClient(context).get(
        `/user/${encodeURIComponent(username(args.username))}/submitted.json?limit=${limit}&raw_json=1`,
      ),
    )
      .slice(0, limit)
      .map(item => postRow(item));
  },
});
