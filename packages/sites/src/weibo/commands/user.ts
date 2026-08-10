import { defineCommand } from '@panerelay/site-kit';
import { user } from '../operations.js';
export default defineCommand({
  name: 'user',
  description: 'Get a Weibo user profile.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Numeric uid or screen name.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'screen_name',
    'uid',
    'followers',
    'following',
    'statuses',
    'verified',
    'description',
    'location',
    'url',
  ],
  examples: ['panerelay weibo user 123456'],
  async run(context, args) {
    return user(context, args);
  },
});
