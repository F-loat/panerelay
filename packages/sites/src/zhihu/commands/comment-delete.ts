import { defineCommand } from '@panerelay/site-kit';
import { commentDelete } from '../operations.js';

export default defineCommand({
  name: 'comment-delete',
  description: 'Delete an owned Zhihu comment and verify its absence.',
  access: 'write',
  args: [
    {
      name: 'target',
      description: 'Numeric comment ID, typed target, or Zhihu URL with a comment fragment.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: ['status', 'outcome', 'message', 'id'],
  examples: ['panerelay zhihu comment-delete comment:123 --execute'],
  async run(context, args) {
    return commentDelete(context, args);
  },
});
