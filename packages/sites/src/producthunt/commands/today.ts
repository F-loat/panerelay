import { defineCommand } from '@panerelay/site-kit';
import { bounded, feed } from '../client.js';
export default defineCommand({
  name: 'today',
  description: 'List Product Hunt launches from the latest feed day.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum launches.', type: 'number', default: 20 }],
  output: ['rank', 'name', 'tagline', 'author', 'url'],
  examples: ['panerelay producthunt today --limit 10'],
  async run(context, args) {
    const rows = await feed(context);
    const latest = rows
      .map(row => String(row.date ?? ''))
      .sort()
      .at(-1);
    return rows
      .filter(row => row.date === latest)
      .slice(0, bounded(args.limit))
      .map((row, index) => ({
        rank: index + 1,
        name: row.name,
        tagline: row.tagline,
        author: row.author,
        url: row.url,
      }));
  },
});
