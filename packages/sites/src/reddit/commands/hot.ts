import { defineCommand } from '@panerelay/site-kit';
import { bounded, listing, postRow, RedditClient, subredditName, text } from '../client.js';

export default defineCommand({
  name: 'hot',
  description: 'List hot Reddit posts.',
  access: 'read',
  args: [
    { name: 'subreddit', description: 'Optional subreddit.', type: 'string', default: '' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 },
  ],
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
  examples: ['panerelay reddit hot --subreddit programming --limit 20'],
  async run(context, args) {
    const limit = bounded(args.limit, 20, 100);
    const sub = text(args.subreddit) ? subredditName(args.subreddit) : '';
    const path = sub ? `/r/${encodeURIComponent(sub)}/hot.json` : '/hot.json';
    return listing(await new RedditClient(context).get(`${path}?limit=${limit}&raw_json=1`))
      .slice(0, limit)
      .map((item, index) => postRow(item, index + 1));
  },
});
