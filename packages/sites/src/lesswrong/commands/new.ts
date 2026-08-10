import { defineCommand } from '@panerelay/site-kit';
import { list, mapPost } from './_shared/client.js';
export default defineCommand({
  name: 'new',
  description: 'List the latest LessWrong posts.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results.', type: 'number', default: 10 }],
  output: ['rank', 'title', 'author', 'karma', 'comments', 'url'],
  examples: ['panerelay lesswrong new --limit 5'],
  async run(context, args) {
    return (await list(context, 'new', args.limit)).map(mapPost);
  },
});
