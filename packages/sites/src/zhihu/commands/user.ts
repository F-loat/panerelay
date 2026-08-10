import { defineCommand } from '@panerelay/site-kit';
import { user } from '../operations.js';

export default defineCommand({
  name: 'user',
  description: 'Get a Zhihu user profile.',
  access: 'read',
  args: [
    {
      name: 'user',
      description: 'User url_token or people URL.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'url_token',
    'name',
    'headline',
    'followers',
    'following',
    'answers',
    'articles',
    'voteup',
    'url',
  ],
  examples: ['panerelay zhihu user wen-jie-16-47'],
  async run(context, args) {
    return user(context, args);
  },
});
