import { defineCommand } from '@panerelay/site-kit';
import { BlueskyClient, limit, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'starter-packs',
  description: 'Get starter packs created by a Bluesky user.',
  access: 'read',
  args: [
    {
      name: 'handle',
      description: 'Bluesky handle',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Number of starter packs', type: 'number', default: 10 },
  ],
  output: ['rank', 'name', 'description', 'members', 'joins'],
  examples: ['panerelay bluesky starter-packs bsky.app'],
  async run(context, args) {
    const take = limit(args.limit, 10);
    const body = (await new BlueskyClient(context).json('app.bsky.graph.getActorStarterPacks', {
      actor: required(args.handle, 'handle'),
      limit: take,
    })) as { starterPacks?: unknown[] };
    return (body.starterPacks ?? []).slice(0, take).map((item, index) => ({
      rank: index + 1,
      name: text(pick(item, 'record.name')),
      description: text(pick(item, 'record.description')),
      members: pick(item, 'listItemCount') ?? null,
      joins: pick(item, 'joinedAllTimeCount') ?? null,
    }));
  },
});
