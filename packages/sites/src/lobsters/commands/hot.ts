import { defineCommand } from '@panerelay/site-kit';
import { LobstersClient, positive, stories } from '../client.js';

export default defineCommand({
  name: 'hot',
  description: 'List the hottest Lobste.rs stories.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum stories', type: 'number', default: 20 }],
  output: ['rank', 'id', 'title', 'score', 'author', 'comments', 'created_at', 'tags', 'url'],
  examples: ['panerelay lobsters hot --limit 10'],
  async run(context, args) {
    return stories(new LobstersClient(context), '/hottest.json', positive(args.limit, 'limit', 20));
  },
});
