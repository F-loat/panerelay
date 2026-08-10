import { defineCommand } from '@panerelay/site-kit';
import { cursor, fetchMemos, positiveInteger, since } from '../client.js';

export default defineCommand({
  name: 'memos',
  description: 'List memos from the signed-in Flomo browser session.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Number of memos', type: 'number', default: 20 },
    {
      name: 'since',
      description: 'Only memos updated after this Unix timestamp',
      type: 'number',
      default: 0,
    },
    { name: 'slug', description: 'Pagination cursor from a previous page', type: 'string' },
  ],
  output: ['id', 'url', 'content', 'slug', 'tags', 'images', 'created_at', 'updated_at'],
  examples: ['panerelay flomo memos --limit 20'],
  run(context, args) {
    return fetchMemos(context, {
      limit: positiveInteger(args.limit, 20, 200, 'limit'),
      since: since(args.since),
      slug: cursor(args.slug),
    });
  },
});
