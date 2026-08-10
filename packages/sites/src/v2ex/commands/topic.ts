import { defineCommand } from '@panerelay/site-kit';
import { pick, required, rows, text, V2exClient } from '../client.js';

export default defineCommand({
  name: 'topic',
  description: 'Read one V2EX topic.',
  access: 'read',
  args: [
    { name: 'id', description: 'Topic ID.', type: 'string', required: true, positional: true },
  ],
  output: ['id', 'title', 'content', 'member', 'created', 'node', 'replies', 'url'],
  examples: ['panerelay v2ex topic 1'],
  async run(context, args) {
    const item = rows(
      await new V2exClient(context).get('topics/show.json', { id: required(args.id, 'topic id') }),
      'v2ex topic',
    )[0];
    if (!item) throw new Error('v2ex topic returned no row');
    return [
      {
        id: pick(item, 'id') ?? '',
        title: text(pick(item, 'title')),
        content: text(pick(item, 'content')),
        member: text(pick(pick(item, 'member'), 'username')),
        created: pick(item, 'created') ?? '',
        node: text(pick(pick(item, 'node'), 'title')),
        replies: pick(item, 'replies') ?? 0,
        url: text(pick(item, 'url')),
      },
    ];
  },
});
