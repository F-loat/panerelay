import { defineCommand } from '@panerelay/site-kit';
import { search } from '../operations.js';
export default defineCommand({
  name: 'search',
  description: 'Search Google Scholar.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'limit', description: 'Maximum results.', type: 'number', default: 10 },
  ],
  output: ['rank', 'title', 'authors', 'source', 'year', 'cited', 'url'],
  examples: ['panerelay google-scholar search transformers'],
  async run(context, args) {
    return search(context, args);
  },
});
