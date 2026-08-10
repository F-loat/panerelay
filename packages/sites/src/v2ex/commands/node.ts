import { defineCommand } from '@panerelay/site-kit';
import { limit, required, rows, topicRow, V2exClient } from '../client.js';

export default defineCommand({
  name: 'node',
  description: 'List topics in a V2EX node.',
  access: 'read',
  args: [
    { name: 'name', description: 'Node name.', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum topics.', type: 'number', default: 10 },
  ],
  output: ['id', 'rank', 'title', 'author', 'node', 'replies', 'url'],
  examples: ['panerelay v2ex node python --limit 10'],
  async run(context, args) {
    const take = limit(args.limit, 10, 20);
    const value = await new V2exClient(context).get('topics/show.json', {
      node_name: required(args.name, 'node'),
    });
    return rows(value, 'v2ex node')
      .slice(0, take)
      .map((item, index) => topicRow(item, index + 1));
  },
});
