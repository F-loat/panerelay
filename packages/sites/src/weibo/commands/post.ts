import { defineCommand } from '@panerelay/site-kit';
import { post } from '../operations.js';
export default defineCommand({
  name: 'post',
  description: 'Get one Weibo post.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Post idstr or mblogid.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['field', 'value'],
  examples: ['panerelay weibo post AbCd123'],
  async run(context, args) {
    return post(context, args);
  },
});
