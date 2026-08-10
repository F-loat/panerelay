import { defineCommand } from '@panerelay/site-kit';
import { WereadClient, object, pick, positive, required, text } from '../client.js';

function date(value: unknown): string {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000 + 8 * 3_600_000).toISOString().slice(0, 10)
    : '-';
}

export default defineCommand({
  name: 'notes',
  description: 'List your notes in a WeRead book.',
  access: 'read',
  args: [
    { name: 'book-id', description: 'Book ID.', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum notes.', type: 'number', default: 20 },
  ],
  output: ['chapter', 'text', 'review', 'createTime'],
  examples: ['panerelay weread notes 123456 --limit 20'],
  async run(context, args) {
    const data = await new WereadClient(context).privateJson('/review/list', {
      bookId: required(args['book-id'], 'book-id'),
      listType: '11',
      mine: '1',
      synckey: '0',
    });
    const reviews = pick(data, 'reviews');
    return (Array.isArray(reviews) ? reviews : [])
      .slice(0, positive(args.limit, 20, 1000, 'limit'))
      .map(raw => {
        const review = object(pick(raw, 'review'));
        return {
          chapter: text(pick(review, 'chapterName')),
          text: text(pick(review, 'abstract')),
          review: text(pick(review, 'content')),
          createTime: date(pick(review, 'createTime')),
        };
      });
  },
});
