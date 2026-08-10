import { defineCommand } from '@panerelay/site-kit';
import { WereadClient, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'book',
  description: 'Get WeRead book details with a logged-in session.',
  access: 'read',
  args: [
    { name: 'book-id', description: 'Book ID.', type: 'string', required: true, positional: true },
  ],
  output: ['title', 'author', 'publisher', 'intro', 'category', 'rating'],
  examples: ['panerelay weread book 123456'],
  async run(context, args) {
    const data = await new WereadClient(context).privateJson('/book/info', {
      bookId: required(args['book-id'], 'book-id'),
    });
    const rating = Number(pick(data, 'newRating'));
    return [
      {
        title: text(pick(data, 'title')),
        author: text(pick(data, 'author')),
        publisher: text(pick(data, 'publisher')),
        intro: text(pick(data, 'intro')),
        category: text(pick(data, 'category')),
        rating: rating > 0 ? `${(rating / 10).toFixed(1)}%` : '-',
      },
    ];
  },
});
