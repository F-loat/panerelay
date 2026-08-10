import { defineCommand } from '@panerelay/site-kit';
import { search } from '../operations.js';
export default defineCommand({
  name: 'search',
  description: 'Search Weibo posts.',
  access: 'read',
  args: [
    {
      name: 'keyword',
      description: 'Search keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results.', type: 'number', default: 10 },
  ],
  output: ['rank', 'id', 'title', 'author', 'time', 'url'],
  examples: ['panerelay weibo search opencli --limit 10'],
  async run(context, args) {
    return search(context, args);
  },
});
