import { defineCommand } from '@panerelay/site-kit';
import { user } from '../operations.js';

export default defineCommand({
  name: 'user',
  description: 'Read a public 1point3acres user profile.',
  access: 'read',
  args: [
    {
      name: 'who',
      description: 'Username or numeric user ID.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'uid',
    'username',
    'group',
    'credits',
    'rice',
    'posts',
    'threads',
    'digests',
    'registerTime',
    'lastAccess',
    'profileUrl',
  ],
  examples: ['panerelay 1point3acres user 12345'],
  async run(context, args) {
    return user(context, args);
  },
});
