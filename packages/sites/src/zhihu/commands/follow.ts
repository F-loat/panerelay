import { defineCommand } from '@panerelay/site-kit';
import { follow } from '../operations.js';

export default defineCommand({
  name: 'follow',
  description: 'Follow a Zhihu user or question.',
  access: 'write',
  args: [
    {
      name: 'target',
      description: 'User/question URL or typed target.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: ['status', 'outcome', 'message', 'target_type', 'target'],
  examples: ['panerelay zhihu follow user:wen-jie-16-47 --execute'],
  async run(context, args) {
    return follow(context, args);
  },
});
