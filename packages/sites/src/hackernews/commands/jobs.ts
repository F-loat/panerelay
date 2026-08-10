import { defineCommand } from '@panerelay/site-kit';
import {
  HackerNewsClient,
  isObject,
  mapWithConcurrency,
  positiveInteger,
  stringValue,
} from '../client.js';

export default defineCommand({
  name: 'jobs',
  description: 'List Hacker News job postings.',
  access: 'read',
  args: [{ name: 'limit', description: 'Number of jobs, up to 50', type: 'number', default: 20 }],
  output: ['rank', 'id', 'title', 'author', 'url'],
  examples: ['panerelay hackernews jobs --limit 10'],
  async run(context, args) {
    const client = new HackerNewsClient(context);
    const limit = positiveInteger(args.limit, 'Hacker News jobs limit', 20);
    const ids = await client.get('/jobstories.json');
    if (!Array.isArray(ids)) throw new Error('Hacker News jobs list is malformed');
    const rows = await mapWithConcurrency(ids.slice(0, Math.min(limit + 10, 50)), 4, id =>
      client.get(`/item/${id}.json`),
    );
    return rows
      .filter(
        (item): item is Record<string, unknown> =>
          isObject(item) && !!item.title && !item.deleted && !item.dead,
      )
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        id: item.id ?? '',
        title: stringValue(item.title),
        author: stringValue(item.by),
        url: stringValue(item.url) || `https://news.ycombinator.com/item?id=${item.id ?? ''}`,
      }));
  },
});
