import { defineCommand } from '@panerelay/site-kit';
import { WereadClient, info, pick, positive, text } from '../client.js';

export default defineCommand({
  name: 'ranking',
  description: 'List public WeRead book rankings by category.',
  access: 'read',
  args: [
    {
      name: 'category',
      description: 'all, rising, or a numeric category ID.',
      type: 'string',
      positional: true,
      default: 'all',
    },
    { name: 'limit', description: 'Maximum books.', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'author', 'category', 'readingCount', 'bookId'],
  examples: ['panerelay weread ranking all --limit 10'],
  async run(context, args) {
    const category = text(args.category || 'all');
    const take = positive(args.limit, 20, 100, 'limit');
    const books = pick(
      await new WereadClient(context).json(
        `/web/bookListInCategory/${encodeURIComponent(category)}`,
        { rank: '1' },
      ),
      'books',
    );
    if (!Array.isArray(books))
      throw new Error('weread ranking returned an unexpected books payload');
    const rows = books
      .slice(0, take)
      .map((item, index) => {
        const book = info(item);
        return {
          rank: index + 1,
          title: text(pick(book, 'title')),
          author: text(pick(book, 'author')),
          category: text(pick(book, 'category')),
          readingCount: Number(pick(item, 'readingCount')) || 0,
          bookId: text(pick(book, 'bookId')),
        };
      })
      .filter(row => row.bookId && row.title);
    if (!rows.length) throw new Error(`weread ranking ${category} returned no books`);
    return rows;
  },
});
