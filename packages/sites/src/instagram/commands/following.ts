import { defineCommand } from '@panerelay/site-kit';
import { following } from '../operations.js';
export default defineCommand({
  name: 'following',
  description: 'List accounts followed by an Instagram user.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'Instagram username.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'limit', description: 'Maximum users.', type: 'number', default: 20 },
  ],
  output: ['rank', 'username', 'name', 'verified', 'private', 'url'],
  examples: ['panerelay instagram following instagram'],
  async run(context, args) {
    return following(context, args);
  },
});
