import { defineCommand } from '@panerelay/site-kit';
import { WereadClient, info, pick, positive, required, resolveUrl, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search public WeRead books.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Book keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum books.', type: 'number', default: 10 },
  ],
  output: ['rank', 'title', 'author', 'bookId', 'url'],
  examples: ['panerelay weread search 三体 --limit 10'],
  async run(context, args) {
    const query = required(args.query, 'query');
    const take = positive(args.limit, 10, 100, 'limit');
    const client = new WereadClient(context);
    const books = await client.searchBooks(query);
    const entries = await client.searchEntries(query);
    const rows = books
      .slice(0, take)
      .map((item, index) => {
        const book = info(item);
        const title = text(pick(book, 'title'));
        const author = text(pick(book, 'author'));
        return {
          rank: index + 1,
          title,
          author,
          bookId: text(pick(book, 'bookId')),
          url: resolveUrl(title, author, entries),
        };
      })
      .filter(row => row.bookId && row.title);
    if (!rows.length) throw new Error(`weread returned no books for "${query}"`);
    return rows;
  },
});
