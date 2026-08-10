import { defineCommand } from '@panerelay/site-kit';
import { WereadClient, object, pick, text } from '../client.js';

export default defineCommand({
  name: 'notebooks',
  description: 'List WeRead books containing your highlights or notes.',
  access: 'read',
  args: [],
  output: ['title', 'author', 'noteCount', 'bookId'],
  examples: ['panerelay weread notebooks'],
  async run(context) {
    const data = await new WereadClient(context).privateJson('/user/notebooks');
    const books = pick(data, 'books');
    return (Array.isArray(books) ? books : []).map(raw => {
      const item = object(raw);
      const book = object(pick(item, 'book'));
      return {
        title: text(pick(book, 'title')),
        author: text(pick(book, 'author')),
        noteCount:
          Number(pick(item, 'bookmarkCount') ?? 0) + Number(pick(item, 'reviewCount') ?? 0),
        bookId: text(pick(item, 'bookId')),
      };
    });
  },
});
