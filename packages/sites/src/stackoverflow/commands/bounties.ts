import { defineCommand } from '@panerelay/site-kit';
import { StackOverflowClient, date, entities, integer, items, pick, text } from '../client.js';
export default defineCommand({
  name: 'bounties',
  description: 'List active Stack Overflow bounties.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results (1-100).', type: 'number', default: 10 }],
  output: [
    'rank',
    'id',
    'bounty',
    'title',
    'score',
    'answers',
    'views',
    'is_answered',
    'tags',
    'author',
    'creation_date',
    'url',
  ],
  examples: ['panerelay stackoverflow bounties --limit 5'],
  async run(context, args) {
    const rows = items(
      await new StackOverflowClient(context).get('/questions/featured', {
        order: 'desc',
        sort: 'activity',
        pagesize: integer(args.limit, 10, 100),
      }),
      'stackoverflow bounties',
    );
    return rows.map((item, index) => ({
      ...item,
      rank: index + 1,
      id: pick(item, 'question_id'),
      bounty: pick(item, 'bounty_amount') || 0,
      title: entities(pick(item, 'title')),
      score: Number(pick(item, 'score')) || 0,
      answers: Number(pick(item, 'answer_count')) || 0,
      views: Number(pick(item, 'view_count')) || 0,
      is_answered: Boolean(pick(item, 'is_answered')),
      tags: Array.isArray(pick(item, 'tags')) ? (pick(item, 'tags') as unknown[]).join(', ') : '',
      author: entities(pick(pick(item, 'owner'), 'display_name')),
      creation_date: date(pick(item, 'creation_date')),
      url: text(pick(item, 'link')),
    }));
  },
});
