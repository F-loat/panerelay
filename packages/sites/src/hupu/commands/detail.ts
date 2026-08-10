import { defineCommand } from '@panerelay/site-kit';
import { detail } from '../operations.js';
export default defineCommand({
  name: 'detail',
  description: 'Read a Hupu thread.',
  access: 'read',
  args: [
    {
      name: 'tid',
      description: 'Nine-digit thread ID.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'replies', description: 'Include top replies.', type: 'boolean', default: false },
  ],
  output: ['title', 'author', 'content', 'replies', 'lights', 'url'],
  examples: ['panerelay hupu detail 123456789 --replies'],
  async run(context, args) {
    return detail(context, args);
  },
});
