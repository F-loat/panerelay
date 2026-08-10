import { defineCommand } from '@panerelay/site-kit';
import { bounded, listing, pick, RedditClient, text, username } from '../client.js';

export default defineCommand({
  name: 'user-comments',
  description: "List a Reddit user's comments.",
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
  output: ['subreddit', 'score', 'body', 'url'],
  examples: ['panerelay reddit user-comments spez --limit 15'],
  async run(context, args) {
    const limit = bounded(args.limit, 15, 100);
    return listing(
      await new RedditClient(context).get(
        `/user/${encodeURIComponent(username(args.username))}/comments.json?limit=${limit}&raw_json=1`,
      ),
    )
      .slice(0, limit)
      .map(item => {
        const body = text(pick(item, 'body'));
        return {
          subreddit: text(pick(item, 'subreddit_name_prefixed')),
          score: pick(item, 'score') ?? 0,
          body: body.length > 300 ? `${body.slice(0, 300)}...` : body,
          url: `https://www.reddit.com${text(pick(item, 'permalink'))}`,
        };
      });
  },
});
