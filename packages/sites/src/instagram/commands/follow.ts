import { defineCommand } from '@panerelay/site-kit';
import { follow } from '../operations.js';
export default defineCommand({
  name: 'follow',
  description: 'Follow an Instagram user.',
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
  examples: ['panerelay instagram follow instagram --execute'],
  async run(context, args) {
    return follow(context, args);
  },
});
