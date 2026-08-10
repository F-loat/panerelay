import { defineCommand } from '@panerelay/site-kit';
import { whoami } from '../operations.js';
export default defineCommand({
  name: 'whoami',
  description: 'Show the signed-in Instagram account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'user_id', 'username', 'full_name'],
  examples: ['panerelay instagram whoami'],
  async run(context) {
    return whoami(context);
  },
});
