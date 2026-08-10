import { defineCommand } from '@panerelay/site-kit';
import { WereadClient, object, pick, positive, required, text } from '../client.js';

function date(value: unknown): string {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000 + 8 * 3_600_000).toISOString().slice(0, 10)
    : '-';
}

export default defineCommand({
  name: 'highlights',
  description: 'List your highlights in a WeRead book.',
  access: 'read',
  args: [
    { name: 'book-id', description: 'Book ID.', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Maximum highlights.', type: 'number', default: 20 },
  ],
  output: ['chapter', 'text', 'createTime'],
  examples: ['panerelay weread highlights 123456 --limit 20'],
  async run(context, args) {
    const data = await new WereadClient(context).privateJson('/book/bookmarklist', {
      bookId: required(args['book-id'], 'book-id'),
    });
    const items = pick(data, 'updated');
    return (Array.isArray(items) ? items : [])
      .slice(0, positive(args.limit, 20, 1000, 'limit'))
      .map(raw => {
        const item = object(raw);
        return {
          chapter: text(pick(item, 'chapterName')),
          text: text(pick(item, 'markText')),
          createTime: date(pick(item, 'createTime')),
        };
      });
  },
});
