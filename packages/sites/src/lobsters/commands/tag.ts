import { defineCommand } from '@panerelay/site-kit';
import { LobstersClient, positive, slug, stories } from '../client.js';

export default defineCommand({
  name: 'tag',
  description: 'List Lobste.rs stories by tag.',
  access: 'read',
  args: [
    { name: 'tag', description: 'Tag name', type: 'string', required: true },
    { name: 'limit', description: 'Maximum stories', type: 'number', default: 20 },
  ],
  output: ['rank', 'id', 'title', 'score', 'author', 'comments', 'created_at', 'tags', 'url'],
  examples: ['panerelay lobsters tag rust --limit 10'],
  async run(context, args) {
    return stories(
      new LobstersClient(context),
      `/t/${encodeURIComponent(slug(args.tag, 'tag'))}.json`,
      positive(args.limit, 'limit', 20),
    );
  },
});
