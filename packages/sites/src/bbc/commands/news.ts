import { defineCommand } from '@panerelay/site-kit';
import { BbcClient, bounded, parse } from '../client.js';

export default defineCommand({
  name: 'news',
  description: 'BBC News headlines.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum headlines', type: 'number', default: 20 }],
  output: ['rank', 'title', 'description', 'url'],
  examples: ['panerelay bbc news --limit 10'],
  async run(context, args) {
    const rows = parse(await new BbcClient(context).rss('rss.xml')).filter(row => row.title);
    return rows.slice(0, bounded(args.limit)).map((row, index) => ({
      rank: index + 1,
      title: row.title,
      description: row.description.slice(0, 200),
      url: row.link,
    }));
  },
});
