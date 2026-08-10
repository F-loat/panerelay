import { defineCommand } from '@panerelay/site-kit';
import { bounded, listing, pick, postRow, RedditClient, text } from '../client.js';

export default defineCommand({
  name: 'saved',
  description: 'List saved Reddit posts and comments.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 15 }],
  output: ['title', 'subreddit', 'score', 'comments', 'url'],
  examples: ['panerelay reddit saved --limit 15'],
  async run(context, args) {
    const client = new RedditClient(context);
    const name = text(pick(await client.me(), 'name'));
    const limit = bounded(args.limit, 15, 100);
    return listing(
      await client.get(`/user/${encodeURIComponent(name)}/saved.json?limit=${limit}&raw_json=1`),
    )
      .slice(0, limit)
      .map(item => {
        const row = postRow(item);
        return { ...row, title: row.title || text(pick(item, 'body')).slice(0, 100) };
      });
  },
});
