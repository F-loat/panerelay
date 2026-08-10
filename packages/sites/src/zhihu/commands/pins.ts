import { defineCommand } from '@panerelay/site-kit';
import { pins } from '../operations.js';

export default defineCommand({
  name: 'pins',
  description: 'List a Zhihu user’s pins.',
  access: 'read',
  args: [
    {
      name: 'user',
      description: 'User url_token or people URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum pins.', type: 'number', default: 20 },
  ],
  output: ['rank', 'excerpt', 'type', 'likes', 'comments', 'reposts', 'created', 'url'],
  examples: ['panerelay zhihu pins wen-jie-16-47 --limit 20'],
  async run(context, args) {
    return pins(context, args);
  },
});
