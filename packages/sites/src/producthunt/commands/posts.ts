import { defineCommand } from '@panerelay/site-kit';
import { bounded, feed } from '../client.js';
export default defineCommand({
  name: 'posts',
  description: 'List latest Product Hunt launches.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum launches.', type: 'number', default: 20 },
    {
      name: 'category',
      description: 'Optional Product Hunt category slug.',
      type: 'string',
      default: '',
    },
  ],
  output: ['rank', 'name', 'tagline', 'author', 'date', 'url'],
  examples: ['panerelay producthunt posts --limit 10'],
  async run(context, args) {
    return (await feed(context, String(args.category ?? '').trim() || undefined)).slice(
      0,
      bounded(args.limit),
    );
  },
});
