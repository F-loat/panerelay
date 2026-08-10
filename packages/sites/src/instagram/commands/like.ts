import { defineCommand } from '@panerelay/site-kit';
import { like } from '../operations.js';
export default defineCommand({
  name: 'like',
  description: 'Like an Instagram post.',
  access: 'write',
  args: [
    {
      name: 'username',
      description: 'Post author.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'index', description: 'One-based post index.', type: 'number', default: 1 },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: ['status', 'user', 'post'],
  examples: ['panerelay instagram like instagram --index 1 --execute'],
  async run(context, args) {
    return like(context, args);
  },
});
