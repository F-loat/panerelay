import { defineCommand } from '@panerelay/site-kit';
import { comments } from '../operations.js';
export default defineCommand({
  name: 'comments',
  description: 'Get comments on a Weibo post.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Numeric post idstr.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum comments.', type: 'number', default: 20 },
  ],
  output: ['rank', 'author', 'text', 'likes', 'replies', 'time'],
  examples: ['panerelay weibo comments 123456 --limit 20'],
  async run(context, args) {
    return comments(context, args);
  },
});
