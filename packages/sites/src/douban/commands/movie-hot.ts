import { defineCommand } from '@panerelay/site-kit';
import { movieHot } from '../operations.js';
export default defineCommand({
  name: 'movie-hot',
  description: 'List popular Douban movies.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum movies.', type: 'number', default: 20 }],
  output: ['rank', 'id', 'title', 'rating', 'votes', 'year', 'url'],
  examples: ['panerelay douban movie-hot --limit 20'],
  async run(context, args) {
    return movieHot(context, args);
  },
});
