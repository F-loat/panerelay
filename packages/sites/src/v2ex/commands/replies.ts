import { defineCommand } from '@panerelay/site-kit';
import { limit, pick, required, rows, text, V2exClient } from '../client.js';

export default defineCommand({
  name: 'replies',
  description: 'List replies for a V2EX topic.',
  access: 'read',
  args: [
    { name: 'id', description: 'Topic ID.', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum replies.', type: 'number', default: 20 },
  ],
  output: ['floor', 'author', 'content'],
  examples: ['panerelay v2ex replies 1 --limit 20'],
  async run(context, args) {
    const take = limit(args.limit, 20, 100);
    return rows(
      await new V2exClient(context).get('replies/show.json', {
        topic_id: required(args.id, 'topic id'),
      }),
      'v2ex replies',
    )
      .slice(0, take)
      .map((item, index) => ({
        floor: index + 1,
        author: text(pick(pick(item, 'member'), 'username')),
        content: text(pick(item, 'content')),
      }));
  },
});
