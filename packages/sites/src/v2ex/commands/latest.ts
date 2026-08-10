import { defineCommand } from '@panerelay/site-kit';
import { limit, rows, topicRow, V2exClient } from '../client.js';

export default defineCommand({
  name: 'latest',
  description: 'List V2EX latest topics.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum topics.', type: 'number', default: 20 }],
  output: ['id', 'rank', 'title', 'author', 'node', 'replies', 'url'],
  examples: ['panerelay v2ex latest --limit 10'],
  async run(context, args) {
    const take = limit(args.limit, 20, 50);
    return rows(await new V2exClient(context).get('topics/latest.json'), 'v2ex latest')
      .slice(0, take)
      .map((item, index) => topicRow(item, index + 1));
  },
});
