import { defineCommand } from '@panerelay/site-kit';
import { list, mapPost } from './_shared/client.js';
export default defineCommand({
  name: 'top-week',
  description: 'List top LessWrong posts from the last week.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results.', type: 'number', default: 10 }],
  output: ['rank', 'title', 'author', 'karma', 'comments', 'url'],
  examples: ['panerelay lesswrong top-week --limit 5'],
  async run(context, args) {
    return (
      await list(context, 'top', args.limit, new Date(Date.now() - 7 * 86400000).toISOString())
    ).map(mapPost);
  },
});
