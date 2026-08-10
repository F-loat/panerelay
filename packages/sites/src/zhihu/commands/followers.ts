import { defineCommand } from '@panerelay/site-kit';
import { followers } from '../operations.js';

export default defineCommand({
  name: 'followers',
  description: 'List a Zhihu user’s followers.',
  access: 'read',
  args: [
    {
      name: 'user',
      description: 'User url_token or people URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum users.', type: 'number', default: 20 },
  ],
  output: ['rank', 'name', 'url_token', 'headline', 'followers', 'url'],
  examples: ['panerelay zhihu followers wen-jie-16-47 --limit 20'],
  async run(context, args) {
    return followers(context, args);
  },
});
