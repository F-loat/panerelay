import { defineCommand } from '@panerelay/site-kit';
import { search } from '../operations.js';

export default defineCommand({
  name: 'search',
  description: 'Search Reuters news.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'limit', description: 'Maximum articles (1-40).', type: 'number', default: 10 },
  ],
  output: ['rank', 'title', 'date', 'section', 'section_path', 'authors', 'url'],
  examples: ['panerelay reuters search markets --limit 10'],
  async run(context, args) {
    return search(context, args);
  },
});
