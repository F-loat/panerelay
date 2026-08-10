import { defineCommand } from '@panerelay/site-kit';
import { followers } from '../operations.js';
export default defineCommand({
  name: 'followers',
  description: 'List Instagram followers.',
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
  examples: ['panerelay instagram followers instagram'],
  async run(context, args) {
    return followers(context, args);
  },
});
