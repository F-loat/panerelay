import { defineCommand } from '@panerelay/site-kit';
import { BlueskyClient, limit, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'followers',
  description: 'List followers of a Bluesky user.',
  access: 'read',
  args: [
    {
      name: 'handle',
      description: 'Bluesky handle',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Number of followers', type: 'number', default: 20 },
  ],
  output: ['rank', 'handle', 'name', 'description'],
  examples: ['panerelay bluesky followers bsky.app'],
  async run(context, args) {
    const take = limit(args.limit, 20);
    const body = (await new BlueskyClient(context).json('app.bsky.graph.getFollowers', {
      actor: required(args.handle, 'handle'),
      limit: take,
    })) as { followers?: unknown[] };
    return (body.followers ?? []).slice(0, take).map((item, index) => ({
      rank: index + 1,
      handle: text(pick(item, 'handle')),
      name: text(pick(item, 'displayName')),
      description: text(pick(item, 'description')),
    }));
  },
});
