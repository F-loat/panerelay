import { defineCommand } from '@panerelay/site-kit';
import { whoami } from '../operations.js';

export default defineCommand({
  name: 'whoami',
  description: 'Show the signed-in Quark account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'nickname'],
  examples: ['panerelay quark whoami'],
  async run(context) {
    return whoami(context);
  },
});
