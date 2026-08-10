import { defineCommand } from '@panerelay/site-kit';
import { user } from '../operations.js';
export default defineCommand({
  name: 'user',
  description: 'Get recent posts from an Instagram user.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Instagram username.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'limit', description: 'Maximum posts.', type: 'number', default: 12 },
  ],
  output: ['index', 'user', 'caption', 'likes', 'comments', 'type', 'code', 'url'],
  examples: ['panerelay instagram user instagram --limit 12'],
  async run(context, args) {
    return user(context, args);
  },
});
