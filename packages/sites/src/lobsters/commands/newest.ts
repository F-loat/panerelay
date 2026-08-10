import { defineCommand } from '@panerelay/site-kit';
import { LobstersClient, positive, stories } from '../client.js';

export default defineCommand({
  name: 'newest',
  description: 'List the newest Lobste.rs stories.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum stories', type: 'number', default: 20 }],
  output: ['rank', 'id', 'title', 'score', 'author', 'comments', 'created_at', 'tags', 'url'],
  examples: ['panerelay lobsters newest --limit 10'],
  async run(context, args) {
    return stories(new LobstersClient(context), '/newest.json', positive(args.limit, 'limit', 20));
  },
});
