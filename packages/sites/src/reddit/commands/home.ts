import { defineCommand } from '@panerelay/site-kit';
import { bounded, listing, postRow, RedditClient } from '../client.js';

export default defineCommand({
  name: 'home',
  description: 'List the personalized Reddit Best feed.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 25 }],
  output: [
    'rank',
    'title',
    'subreddit',
    'score',
    'comments',
    'postId',
    'author',
    'url',
    'post_hint',
    'url_overridden_by_dest',
    'preview_image_url',
    'gallery_urls',
  ],
  examples: ['panerelay reddit home --limit 25'],
  async run(context, args) {
    const client = new RedditClient(context);
    await client.me();
    const limit = bounded(args.limit, 25, 100);
    return listing(await client.get(`/best.json?limit=${limit}&raw_json=1`))
      .slice(0, limit)
      .map((item, index) => postRow(item, index + 1));
  },
});
