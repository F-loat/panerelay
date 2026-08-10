import { defineCommand } from '@panerelay/site-kit';
import { profile } from '../operations.js';
export default defineCommand({
  name: 'profile',
  description: 'Get an Instagram profile.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Instagram username.',
      type: 'string',
      positional: true,
      required: true,
    },
  ],
  output: ['username', 'name', 'followers', 'following', 'posts', 'verified', 'bio', 'url'],
  examples: ['panerelay instagram profile instagram'],
  async run(context, args) {
    return profile(context, args);
  },
});
