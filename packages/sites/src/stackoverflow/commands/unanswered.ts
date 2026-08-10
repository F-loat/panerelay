import { defineCommand } from '@panerelay/site-kit';
import { StackOverflowClient, integer, items, question } from '../client.js';
export default defineCommand({
  name: 'unanswered',
  description: 'List top-voted unanswered Stack Overflow questions.',
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
  examples: ['panerelay stackoverflow unanswered --limit 5'],
  async run(context, args) {
    return items(
      await new StackOverflowClient(context).get('/questions/unanswered', {
        order: 'desc',
        sort: 'votes',
        pagesize: integer(args.limit, 10, 100),
      }),
      'stackoverflow unanswered',
    ).map(question);
  },
});
