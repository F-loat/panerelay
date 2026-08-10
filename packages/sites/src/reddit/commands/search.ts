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
  name: 'search',
  description: 'Search Reddit posts.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'subreddit', description: 'Optional subreddit.', type: 'string', default: '' },
    { name: 'sort', description: 'Sort order.', type: 'string', default: 'relevance' },
    { name: 'time', description: 'Time filter.', type: 'string', default: 'all' },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 15 },
  ],
  output: [
    'id',
    'title',
    'subreddit',
    'author',
    'score',
    'comments',
    'url',
    'created_utc',
    'selftext',
    'post_hint',
    'url_overridden_by_dest',
    'preview_image_url',
    'gallery_urls',
  ],
  examples: ['panerelay reddit search Panerelay --sort relevance --limit 15'],
  async run(context, args) {
    const limit = bounded(args.limit, 15, 100);
    const sub = text(args.subreddit) ? subredditName(args.subreddit) : '';
    const query = new URLSearchParams({
      q: required(args.query, 'query'),
      sort: text(args.sort) || 'relevance',
      t: text(args.time) || 'all',
      limit: String(limit),
      restrict_sr: sub ? 'on' : 'off',
      raw_json: '1',
    });
    const path = sub ? `/r/${encodeURIComponent(sub)}/search.json` : '/search.json';
    return listing(await new RedditClient(context).get(`${path}?${query}`))
      .slice(0, limit)
      .map(item => postRow(item));
  },
});
