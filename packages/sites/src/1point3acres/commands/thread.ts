import { defineCommand } from '@panerelay/site-kit';
import { thread } from '../operations.js';

export default defineCommand({
  name: 'thread',
  description: 'Read a 1point3acres thread and its replies.',
  access: 'read',
  args: [
    {
      name: 'tid',
      description: 'Numeric thread ID.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'page', description: 'Positive page number.', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum posts.', type: 'number', default: 10 },
    {
      name: 'content-limit',
      description: 'Maximum characters retained per post.',
      type: 'number',
      default: 400,
    },
  ],
  output: ['floor', 'pid', 'author', 'postTime', 'content', 'url'],
  examples: ['panerelay 1point3acres thread 1158360 --limit 10'],
  async run(context, args) {
    return thread(context, args);
  },
});
