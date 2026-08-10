import { defineCommand } from '@panerelay/site-kit';
import { BlueskyClient, limit, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'user',
  description: 'Get recent posts from a Bluesky user.',
  access: 'read',
  args: [
    {
      name: 'handle',
      description: 'Bluesky handle',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Number of posts', type: 'number', default: 20 },
  ],
  output: ['rank', 'uri', 'text', 'likes', 'reposts', 'replies'],
  examples: ['panerelay bluesky user bsky.app'],
  async run(context, args) {
    const take = limit(args.limit, 20);
    const body = (await new BlueskyClient(context).json('app.bsky.feed.getAuthorFeed', {
      actor: required(args.handle, 'handle'),
      limit: take,
    })) as { feed?: unknown[] };
    return (body.feed ?? []).slice(0, take).map((item, index) => ({
      rank: index + 1,
      uri: text(pick(item, 'post.uri')),
      text: text(pick(item, 'post.record.text')),
      likes: pick(item, 'post.likeCount') ?? null,
      reposts: pick(item, 'post.repostCount') ?? null,
      replies: pick(item, 'post.replyCount') ?? null,
    }));
  },
});
