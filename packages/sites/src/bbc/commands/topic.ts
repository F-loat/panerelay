import { defineCommand } from '@panerelay/site-kit';
import { BbcClient, TOPICS, bounded, parse, text } from '../client.js';

export default defineCommand({
  name: 'topic',
  description: 'BBC News headlines for a section.',
  access: 'read',
  args: [
    { name: 'topic', description: 'BBC section', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum headlines', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'description', 'pubDate', 'url'],
  examples: ['panerelay bbc topic technology --limit 10'],
  async run(context, args) {
    const topic = text(args.topic)
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (!TOPICS.includes(topic)) throw new Error(`bbc topic "${args.topic}" is not supported`);
    const rows = parse(await new BbcClient(context).rss(`${topic}/rss.xml`)).filter(
      row => row.title,
    );
    return rows.slice(0, bounded(args.limit)).map((row, index) => ({
      rank: index + 1,
      title: row.title,
      description: row.description,
      pubDate: row.pubDate ? new Date(row.pubDate).toISOString().slice(0, 10) : '',
      url: row.link,
    }));
  },
});
