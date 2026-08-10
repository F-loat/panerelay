import { defineCommand } from '@panerelay/site-kit';
import { unfollow } from '../operations.js';
export default defineCommand({
  name: 'unfollow',
  description: 'Unfollow an Instagram user.',
  access: 'write',
  args: [
    {
      name: 'username',
      description: 'Instagram username.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: ['status', 'username'],
  examples: ['panerelay instagram unfollow instagram --execute'],
  async run(context, args) {
    return unfollow(context, args);
  },
});
