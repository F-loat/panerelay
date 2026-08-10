import { defineCommand } from '@panerelay/site-kit';
import { top250 } from '../operations.js';
export default defineCommand({
  name: 'top250',
  description: 'List the Douban movie Top 250.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum movies.', type: 'number', default: 250 }],
  output: ['rank', 'id', 'title', 'rating', 'votes', 'year', 'url'],
  examples: ['panerelay douban top250 --limit 25'],
  async run(context, args) {
    return top250(context, args);
  },
});
