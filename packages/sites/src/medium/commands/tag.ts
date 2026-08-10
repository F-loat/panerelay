import { defineCommand } from '@panerelay/site-kit';
import { feed } from '../client.js';
export default defineCommand({
  name: 'tag',
  description: 'List newest Medium articles for a tag through RSS.',
  access: 'read',
  args: [
    {
      name: 'tag',
      description: 'Lowercase tag slug.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum articles (1-25).', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'author', 'description', 'published', 'url'],
  examples: ['panerelay medium tag programming --limit 5'],
  async run(context, args) {
    const limit = args.limit == null || args.limit === '' ? 20 : Number(args.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25)
      throw new Error('medium limit must be an integer between 1 and 25');
    return feed(context, String(args.tag), limit);
  },
});
