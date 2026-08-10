import { defineCommand } from '@panerelay/site-kit';
import { bounded, listing, postRow, RedditClient } from '../client.js';

export default defineCommand({
  name: 'frontpage',
  description: 'List Reddit r/all posts.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 15 }],
  output: [
    'title',
    'subreddit',
    'author',
    'upvotes',
    'comments',
    'url',
    'post_hint',
    'url_overridden_by_dest',
    'preview_image_url',
    'gallery_urls',
  ],
  examples: ['panerelay reddit frontpage --limit 15'],
  async run(context, args) {
    const limit = bounded(args.limit, 15, 100);
    return listing(await new RedditClient(context).get(`/r/all.json?limit=${limit}&raw_json=1`))
      .slice(0, limit)
      .map(item => postRow(item));
  },
});
