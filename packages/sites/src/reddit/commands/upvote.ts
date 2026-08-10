import { defineCommand } from '@panerelay/site-kit';
import { postFullname, RedditClient, text } from '../client.js';

export default defineCommand({
  name: 'upvote',
  description: 'Upvote, downvote, or clear a Reddit vote.',
  access: 'write',
  args: [
    {
      name: 'post-id',
      description: 'Post ID, fullname, or URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'direction', description: 'up, down, or none.', type: 'string', default: 'up' },
  ],
  output: ['status', 'message'],
  examples: ['panerelay reddit upvote 1abc123 --direction up'],
  async run(context, args) {
    const client = new RedditClient(context);
    const fullname = postFullname(args['post-id']);
    const direction = text(args.direction) || 'up';
    if (!['up', 'down', 'none'].includes(direction))
      throw new Error('reddit direction must be up, down, or none');
    const dir = direction === 'down' ? '-1' : direction === 'none' ? '0' : '1';
    await client.post('/api/vote', { id: fullname, dir, uh: await client.modhash() });
    const label = dir === '1' ? 'Upvoted' : dir === '-1' ? 'Downvoted' : 'Vote removed';
    return [{ status: 'success', message: `${label} ${fullname}` }];
  },
});
