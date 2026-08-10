import { defineCommand } from '@panerelay/site-kit';
import { BlueskyClient, limit, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'following',
  description: 'List accounts a Bluesky user follows.',
  access: 'read',
  args: [
    {
      name: 'handle',
      description: 'Bluesky handle',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Number of accounts', type: 'number', default: 20 },
  ],
  output: ['rank', 'handle', 'name', 'description'],
  examples: ['panerelay bluesky following bsky.app'],
  async run(context, args) {
    const take = limit(args.limit, 20);
    const body = (await new BlueskyClient(context).json('app.bsky.graph.getFollows', {
      actor: required(args.handle, 'handle'),
      limit: take,
    })) as { follows?: unknown[] };
    return (body.follows ?? []).slice(0, take).map((item, index) => ({
      rank: index + 1,
      handle: text(pick(item, 'handle')),
      name: text(pick(item, 'displayName')),
      description: text(pick(item, 'description')),
    }));
  },
});
