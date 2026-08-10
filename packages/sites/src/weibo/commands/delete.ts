import { defineCommand } from '@panerelay/site-kit';
import { remove } from '../operations.js';
export default defineCommand({
  name: 'delete',
  description: 'Delete one of the logged-in account’s Weibo posts.',
  access: 'write',
  args: [
    {
      name: 'id',
      description: 'Post idstr, mblogid, or URL.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['status', 'id', 'mblogid'],
  examples: ['panerelay weibo delete AbCd123'],
  async run(context, args) {
    return remove(context, args);
  },
});
