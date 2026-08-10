import { defineCommand } from '@panerelay/site-kit';
import { bookHot } from '../operations.js';
export default defineCommand({
  name: 'book-hot',
  description: 'List popular Douban books.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum books.', type: 'number', default: 20 }],
  output: ['rank', 'title', 'rating', 'quote', 'author', 'publisher', 'year', 'url'],
  examples: ['panerelay douban book-hot --limit 20'],
  async run(context, args) {
    return bookHot(context, args);
  },
});
