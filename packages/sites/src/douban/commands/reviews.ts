import { defineCommand } from '@panerelay/site-kit';
import { reviews } from '../operations.js';
export default defineCommand({
  name: 'reviews',
  description: 'Export Douban movie reviews.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum reviews.', type: 'number', default: 20 },
    { name: 'uid', description: 'Douban user ID; defaults to current account.', type: 'string' },
    { name: 'full', description: 'Fetch full review pages.', type: 'boolean', default: false },
  ],
  output: ['movie_title', 'title', 'my_rating', 'votes', 'content', 'url'],
  examples: ['panerelay douban reviews --limit 20 --full'],
  async run(context, args) {
    return reviews(context, args);
  },
});
