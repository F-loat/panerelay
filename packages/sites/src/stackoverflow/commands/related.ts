import { defineCommand } from '@panerelay/site-kit';
import { StackOverflowClient, integer, items, question, required } from '../client.js';
export default defineCommand({
  name: 'related',
  description: 'List questions related to a Stack Overflow question.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Numeric question id.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results (1-100).', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'id',
    'title',
    'score',
    'answers',
    'views',
    'isAnswered',
    'tags',
    'author',
    'createdAt',
    'lastActivityAt',
    'url',
  ],
  examples: ['panerelay stackoverflow related 79935770'],
  async run(context, args) {
    const id = required(args.id, 'question id');
    if (!/^\d+$/.test(id)) throw new Error('stackoverflow question id must be numeric');
    return items(
      await new StackOverflowClient(context).get(`/questions/${id}/related`, {
        order: 'desc',
        sort: 'rank',
        pagesize: integer(args.limit, 20, 100),
      }),
      'stackoverflow related',
    ).map(question);
  },
});
