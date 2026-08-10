import { defineCommand } from '@panerelay/site-kit';
import { BlueskyClient, limit, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search Bluesky users.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Number of results', type: 'number', default: 10 },
  ],
  output: ['rank', 'handle', 'name', 'followers', 'description'],
  examples: ['panerelay bluesky search bsky'],
  async run(context, args) {
    const take = limit(args.limit, 10);
    const body = (await new BlueskyClient(context).json('app.bsky.actor.searchActors', {
      q: required(args.query, 'query'),
      limit: take,
    })) as { actors?: unknown[] };
    return (body.actors ?? []).slice(0, take).map((item, index) => ({
      rank: index + 1,
      handle: text(pick(item, 'handle')),
      name: text(pick(item, 'displayName')),
      followers: pick(item, 'followersCount') ?? null,
      description: text(pick(item, 'description')),
    }));
  },
});
