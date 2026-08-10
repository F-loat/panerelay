import { defineCommand } from '@panerelay/site-kit';
import { limit, rss } from '../client.js';

export default defineCommand({
  name: 'trends',
  description: 'Get Google Trends daily searches through RSS.',
  access: 'read',
  args: [
    { name: 'region', description: 'Region code.', type: 'string', default: 'US' },
    { name: 'limit', description: 'Maximum trends.', type: 'number', default: 20 },
  ],
  output: ['title', 'traffic', 'date'],
  examples: ['panerelay google trends --region US --limit 10'],
  async run(context, args) {
    const region = encodeURIComponent(String(args.region || 'US'));
    const rows = await rss(
      context,
      `https://trends.google.com/trending/rss?geo=${region}`,
      limit(args.limit, 20),
    );
    return rows.map(row => ({ title: row.title, traffic: row.traffic, date: row.date }));
  },
});
