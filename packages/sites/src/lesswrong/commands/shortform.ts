import { defineCommand } from '@panerelay/site-kit';
import { list, mapPost } from './_shared/client.js';
export default defineCommand({
  name: 'shortform',
  description: 'List LessWrong shortform posts.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results.', type: 'number', default: 10 }],
  output: ['rank', 'title', 'author', 'karma', 'comments', 'url'],
  examples: ['panerelay lesswrong shortform --limit 5'],
  async run(context, args) {
    return (await list(context, 'shortform', args.limit)).map(mapPost);
  },
});
