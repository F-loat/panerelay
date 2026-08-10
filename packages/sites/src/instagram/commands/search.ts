import { defineCommand } from '@panerelay/site-kit';
import { search } from '../operations.js';
export default defineCommand({
  name: 'search',
  description: 'Search Instagram users.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'limit', description: 'Maximum users.', type: 'number', default: 10 },
  ],
  output: ['rank', 'username', 'name', 'verified', 'private', 'url'],
  examples: ['panerelay instagram search openai'],
  async run(context, args) {
    return search(context, args);
  },
});
