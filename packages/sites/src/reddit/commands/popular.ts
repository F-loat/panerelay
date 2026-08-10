import { defineCommand } from '@panerelay/site-kit';
import { bounded, listing, postRow, RedditClient } from '../client.js';

export default defineCommand({
  name: 'popular',
  description: 'List Reddit r/popular posts.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 }],
  output: [
    'rank',
    'id',
    'title',
    'subreddit',
    'score',
    'comments',
    'author',
    'url',
    'created_utc',
    'selftext',
    'post_hint',
    'url_overridden_by_dest',
    'preview_image_url',
    'gallery_urls',
  ],
  examples: ['panerelay reddit popular --limit 20'],
  async run(context, args) {
    const limit = bounded(args.limit, 20, 100);
    return listing(await new RedditClient(context).get(`/r/popular.json?limit=${limit}&raw_json=1`))
      .slice(0, limit)
      .map((item, index) => postRow(item, index + 1));
  },
});
