import { defineCommand } from '@panerelay/site-kit';
import { LobstersClient, positive, stories } from '../client.js';

export default defineCommand({
  name: 'active',
  description: 'List the most active Lobste.rs stories.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum stories', type: 'number', default: 20 }],
  output: ['rank', 'id', 'title', 'score', 'author', 'comments', 'created_at', 'tags', 'url'],
  examples: ['panerelay lobsters active --limit 10'],
  async run(context, args) {
    return stories(new LobstersClient(context), '/active.json', positive(args.limit, 'limit', 20));
  },
});
