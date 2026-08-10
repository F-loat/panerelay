import { defineCommand } from '@panerelay/site-kit';
import { search } from '../operations.js';

export default defineCommand({
  name: 'search',
  description: 'Search Zhihu content.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum results.', type: 'number', default: 10 },
    {
      name: 'type',
      description: 'Result type: all, answer, article, or question.',
      type: 'string',
      default: 'all',
    },
  ],
  output: ['rank', 'title', 'type', 'author', 'votes', 'url'],
  examples: ['panerelay zhihu search codex --type answer'],
  async run(context, args) {
    return search(context, args);
  },
});
