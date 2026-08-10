import { defineCommand } from '@panerelay/site-kit';
import { StackOverflowClient, integer, items, question, required } from '../client.js';
export default defineCommand({
  name: 'tag',
  description: 'List Stack Overflow questions by tag.',
  access: 'read',
  args: [
    { name: 'tag', description: 'Tag slug.', type: 'string', required: true, positional: true },
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
  examples: ['panerelay stackoverflow tag typescript --limit 5'],
  async run(context, args) {
    return items(
      await new StackOverflowClient(context).get('/questions', {
        tagged: required(args.tag, 'tag'),
        order: 'desc',
        sort: 'activity',
        pagesize: integer(args.limit, 20, 100),
      }),
      'stackoverflow tag',
    ).map(question);
  },
});
