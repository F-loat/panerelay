import { defineCommand } from '@panerelay/site-kit';
import { list, mapPost } from './_shared/client.js';
export default defineCommand({
  name: 'curated',
  description: "List LessWrong editor's picks.",
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum results.', type: 'number', default: 10 }],
  output: ['rank', 'title', 'author', 'karma', 'comments', 'url'],
  examples: ['panerelay lesswrong curated --limit 5'],
  async run(context, args) {
    return (await list(context, 'curated', args.limit)).map(mapPost);
  },
});
