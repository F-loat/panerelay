import { defineCommand } from '@panerelay/site-kit';
import { search } from '../operations.js';
export default defineCommand({
  name: 'search',
  description: 'Search Douban subjects exposed in the HTTP response.',
  access: 'read',
  args: [
    {
      name: 'keyword',
      description: 'Search keyword.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'type', description: 'movie, book, or music.', type: 'string', default: 'movie' },
    { name: 'limit', description: 'Maximum results.', type: 'number', default: 20 },
  ],
  output: ['rank', 'id', 'type', 'title', 'rating', 'abstract', 'url'],
  examples: ['panerelay douban search 三体 --type book'],
  async run(context, args) {
    return search(context, args);
  },
});
