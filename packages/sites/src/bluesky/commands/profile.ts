import { defineCommand } from '@panerelay/site-kit';
import { BlueskyClient, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'profile',
  description: 'Get Bluesky user profile info.',
  access: 'read',
  args: [
    {
      name: 'handle',
      description: 'Bluesky handle',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['handle', 'name', 'followers', 'following', 'posts', 'description'],
  examples: ['panerelay bluesky profile bsky.app'],
  async run(context, args) {
    const item = await new BlueskyClient(context).json('app.bsky.actor.getProfile', {
      actor: required(args.handle, 'handle'),
    });
    return {
      handle: text(pick(item, 'handle')),
      name: text(pick(item, 'displayName')),
      followers: pick(item, 'followersCount') ?? null,
      following: pick(item, 'followsCount') ?? null,
      posts: pick(item, 'postsCount') ?? null,
      description: text(pick(item, 'description')),
    };
  },
});
