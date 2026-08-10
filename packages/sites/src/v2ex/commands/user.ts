import { defineCommand } from '@panerelay/site-kit';
import { limit, required, rows, topicRow, V2exClient } from '../client.js';

export default defineCommand({
  name: 'user',
  description: 'List topics created by a V2EX member.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Username.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum topics.', type: 'number', default: 10 },
  ],
  output: ['id', 'rank', 'title', 'author', 'node', 'replies', 'url'],
  examples: ['panerelay v2ex user Livid --limit 10'],
  async run(context, args) {
    const take = limit(args.limit, 10, 20);
    return rows(
      await new V2exClient(context).get('topics/show.json', {
        username: required(args.username, 'username'),
      }),
      'v2ex user',
    )
      .slice(0, take)
      .map((item, index) => topicRow(item, index + 1));
  },
});
