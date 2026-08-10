import { defineCommand } from '@panerelay/site-kit';
import { comment } from '../operations.js';
export default defineCommand({
  name: 'comment',
  description: 'Comment on an Instagram post.',
  access: 'write',
  args: [
    {
      name: 'username',
      description: 'Post author.',
      type: 'string',
      positional: true,
      required: true,
    },
    {
      name: 'text',
      description: 'Comment text.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'index', description: 'One-based post index.', type: 'number', default: 1 },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: ['status', 'user', 'text'],
  examples: ['panerelay instagram comment instagram "Nice" --execute'],
  async run(context, args) {
    return comment(context, args);
  },
});
