import { defineCommand } from '@panerelay/site-kit';
import {
  bounded,
  listing,
  postRow,
  RedditClient,
  required,
  subredditName,
  text,
} from '../client.js';

export default defineCommand({
  name: 'subreddit',
  description: 'List posts from a subreddit.',
  access: 'read',
  args: [
    {
      name: 'name',
      description: 'Subreddit name.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'sort',
      description: 'hot, new, top, rising, or controversial.',
      type: 'string',
      default: 'hot',
    },
    { name: 'time', description: 'Time filter.', type: 'string', default: 'all' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 15 },
  ],
  output: [
    'id',
    'title',
    'subreddit',
    'author',
    'upvotes',
    'comments',
    'url',
    'created_utc',
    'selftext',
    'post_hint',
    'url_overridden_by_dest',
    'preview_image_url',
    'gallery_urls',
  ],
  examples: ['panerelay reddit subreddit python --sort top --time week --limit 15'],
  async run(context, args) {
    const sub = subredditName(required(args.name, 'name'));
    const sort = text(args.sort) || 'hot';
    if (!['hot', 'new', 'top', 'rising', 'controversial'].includes(sort))
      throw new Error('reddit subreddit sort is invalid');
    const time = text(args.time) || 'all';
    const limit = bounded(args.limit, 15, 100);
    const query = new URLSearchParams({ limit: String(limit), raw_json: '1' });
    if (['top', 'controversial'].includes(sort)) query.set('t', time);
    return listing(
      await new RedditClient(context).get(`/r/${encodeURIComponent(sub)}/${sort}.json?${query}`),
    )
      .slice(0, limit)
      .map(item => postRow(item));
  },
});
