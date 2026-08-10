import { defineCommand } from '@panerelay/site-kit';
import { list, mapPost } from './_shared/client.js';
export default defineCommand({
  name: 'frontpage',
  description: 'List the LessWrong algorithmic frontpage.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results.', type: 'number', default: 10 }],
  output: ['rank', 'title', 'author', 'karma', 'comments', 'url'],
  examples: ['panerelay lesswrong frontpage --limit 5'],
  async run(context, args) {
    return (await list(context, 'frontpage', args.limit)).map(mapPost);
  },
});
