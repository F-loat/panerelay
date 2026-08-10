import { defineCommand } from '@panerelay/site-kit';
import { BloombergClient } from '../client.js';

export default defineCommand({
  name: 'economics',
  description: 'List Bloomberg Economics RSS stories.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum stories (1-20).', type: 'number', default: 5 }],
  output: ['rank', 'title', 'summary', 'link', 'published'],
  examples: ['panerelay bloomberg economics --limit 5'],
  async run(context, args) {
    const limit = args.limit == null || args.limit === '' ? 5 : Number(args.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new Error('bloomberg limit must be an integer between 1 and 20');
    return new BloombergClient(context).feed('economics', limit);
  },
});
