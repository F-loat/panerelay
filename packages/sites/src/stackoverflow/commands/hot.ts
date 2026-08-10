import { defineCommand } from '@panerelay/site-kit';
import { StackOverflowClient, integer, items, question } from '../client.js';
export default defineCommand({
  name: 'hot',
  description: 'List hot Stack Overflow questions.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results (1-100).', type: 'number', default: 10 }],
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
  examples: ['panerelay stackoverflow hot --limit 5'],
  async run(context, args) {
    const rows = items(
      await new StackOverflowClient(context).get('/questions', {
        order: 'desc',
        sort: 'hot',
        pagesize: integer(args.limit, 10, 100),
      }),
      'stackoverflow hot',
    );
    return rows.map(question);
  },
});
