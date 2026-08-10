import { defineCommand } from '@panerelay/site-kit';
import { limit, rows, topicRow, V2exClient } from '../client.js';

export default defineCommand({
  name: 'hot',
  description: 'List V2EX hot topics.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum topics.', type: 'number', default: 20 }],
  output: ['id', 'rank', 'title', 'author', 'node', 'replies', 'url'],
  examples: ['panerelay v2ex hot --limit 10'],
  async run(context, args) {
    const take = limit(args.limit, 20, 50);
    return rows(await new V2exClient(context).get('topics/hot.json'), 'v2ex hot')
      .slice(0, take)
      .map((item, index) => topicRow(item, index + 1));
  },
});
