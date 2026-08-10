import { defineCommand } from '@panerelay/site-kit';
import { forum } from '../operations.js';

export default defineCommand({
  name: 'forum',
  description: 'List threads from one 1point3acres forum ID.',
  access: 'read',
  args: [
    {
      name: 'fid',
      description: 'Numeric forum ID.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'page', description: 'Positive page number.', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum threads.', type: 'number', default: 20 },
  ],
  output: ['rank', 'tid', 'kind', 'title', 'author', 'replies', 'views', 'lastReplyTime', 'url'],
  examples: ['panerelay 1point3acres forum 198 --limit 20'],
  async run(context, args) {
    return forum(context, args);
  },
});
