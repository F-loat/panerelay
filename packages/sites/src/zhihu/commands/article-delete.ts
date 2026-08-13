import { defineCommand } from '@panerelay/site-kit';
import { articleDelete } from '../operations.js';

export default defineCommand({
  name: 'article-delete',
  description: 'Delete and verify removal of an owned private Zhihu article draft.',
  access: 'write',
  args: [
    {
      name: 'target',
      description: 'Private draft article URL or article:<id>.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'execute', description: 'Confirm the private draft deletion.', type: 'boolean' },
  ],
  output: ['status', 'outcome', 'message', 'id'],
  examples: ['panerelay zhihu article-delete article:123 --execute'],
  async run(context, args) {
    return articleDelete(context, args);
  },
});
