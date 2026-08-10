import { defineCommand } from '@panerelay/site-kit';
import { LobstersClient, hostname, positive, stories } from '../client.js';

export default defineCommand({
  name: 'domain',
  description: 'List Lobste.rs stories submitted from a domain.',
  access: 'read',
  args: [
    { name: 'domain', description: 'Source hostname', type: 'string', required: true },
    { name: 'limit', description: 'Maximum stories', type: 'number', default: 20 },
  ],
  output: ['rank', 'id', 'title', 'score', 'author', 'comments', 'created_at', 'tags', 'url'],
  examples: ['panerelay lobsters domain github.com --limit 10'],
  async run(context, args) {
    return stories(
      new LobstersClient(context),
      `/domains/${encodeURIComponent(hostname(args.domain))}.json`,
      positive(args.limit, 'limit', 20, 25),
    );
  },
});
