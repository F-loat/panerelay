import { defineCommand } from '@panerelay/site-kit';
import { unsave } from '../operations.js';
export default defineCommand({
  name: 'unsave',
  description: 'Remove an Instagram saved post.',
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
  examples: ['panerelay instagram unsave instagram --execute'],
  async run(context, args) {
    return unsave(context, args);
  },
});
