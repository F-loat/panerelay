import { defineCommand } from '@panerelay/site-kit';
import { StackOverflowClient, integer, items, question, required } from '../client.js';
export default defineCommand({
  name: 'search',
  description: 'Search Stack Overflow questions.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search text.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results (1-100).', type: 'number', default: 10 },
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
  examples: ['panerelay stackoverflow search browser --limit 5'],
  async run(context, args) {
    const query = required(args.query, 'query');
    return items(
      await new StackOverflowClient(context).get('/search/advanced', {
        q: query,
        order: 'desc',
        sort: 'relevance',
        pagesize: integer(args.limit, 10, 100),
      }),
      'stackoverflow search',
    ).map(question);
  },
});
