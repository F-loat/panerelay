import { defineCommand } from '@panerelay/site-kit';
import { list, mapPost } from './_shared/client.js';
export default defineCommand({
  name: 'top',
  description: 'List top all-time LessWrong posts.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results.', type: 'number', default: 10 }],
  output: ['rank', 'title', 'author', 'karma', 'comments', 'url'],
  examples: ['panerelay lesswrong top --limit 5'],
  async run(context, args) {
    return (await list(context, 'top', args.limit)).map(mapPost);
  },
});
