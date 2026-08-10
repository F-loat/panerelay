import { defineCommand } from '@panerelay/site-kit';
import { like } from '../operations.js';

export default defineCommand({
  name: 'like',
  description: 'Like a Zhihu answer or article.',
  access: 'write',
  args: [
    {
      name: 'target',
      description: 'Answer/article URL or typed target.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: ['status', 'outcome', 'message', 'target_type', 'target'],
  examples: ['panerelay zhihu like answer:123:456 --execute'],
  async run(context, args) {
    return like(context, args);
  },
});
