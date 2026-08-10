import { defineCommand } from '@panerelay/site-kit';
import { postFullname, RedditClient } from '../client.js';

export default defineCommand({
  name: 'save',
  description: 'Save or unsave a Reddit post.',
  access: 'write',
  args: [
    {
      name: 'post-id',
      description: 'Post ID, fullname, or URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'undo', description: 'Unsave instead of save.', type: 'boolean', default: false },
  ],
  output: ['status', 'message'],
  examples: ['panerelay reddit save 1abc123'],
  async run(context, args) {
    const client = new RedditClient(context);
    const fullname = postFullname(args['post-id']);
    await client.post(args.undo ? '/api/unsave' : '/api/save', {
      id: fullname,
      uh: await client.modhash(),
    });
    return [{ status: 'success', message: `${args.undo ? 'Unsaved' : 'Saved'} ${fullname}` }];
  },
});
