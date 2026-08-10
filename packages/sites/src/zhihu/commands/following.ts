import { defineCommand } from '@panerelay/site-kit';
import { following } from '../operations.js';

export default defineCommand({
  name: 'following',
  description: 'List people followed by a Zhihu user.',
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
  examples: ['panerelay zhihu following wen-jie-16-47 --limit 20'],
  async run(context, args) {
    return following(context, args);
  },
});
