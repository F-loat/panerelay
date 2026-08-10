import { defineCommand } from '@panerelay/site-kit';
import { BlueskyClient, limit, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'thread',
  description: 'Get a Bluesky post thread with replies.',
  access: 'read',
  args: [
    {
      name: 'uri',
      description: 'Post AT URI or Bluesky URL',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Number of replies', type: 'number', default: 20 },
  ],
  output: ['author', 'text', 'likes', 'reposts', 'replies_count'],
  examples: ['panerelay bluesky thread at://did:plc:abc/app.bsky.feed.post/123'],
  async run(context, args) {
    const take = limit(args.limit, 20);
    const body = (await new BlueskyClient(context).json('app.bsky.feed.getPostThread', {
      uri: required(args.uri, 'uri'),
      depth: 2,
    })) as { thread?: unknown };
    const thread = pick(body, 'thread');
    const rows = [thread, ...((pick(thread, 'replies') as unknown[]) ?? [])];
    return rows.slice(0, take).map(item => ({
      author: text(pick(item, 'post.author.handle')),
      text: text(pick(item, 'post.record.text')),
      likes: pick(item, 'post.likeCount') ?? null,
      reposts: pick(item, 'post.repostCount') ?? null,
      replies_count: pick(item, 'post.replyCount') ?? null,
    }));
  },
});
