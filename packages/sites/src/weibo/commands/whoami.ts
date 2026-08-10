import { defineCommand } from '@panerelay/site-kit';
import { whoami } from '../operations.js';
export default defineCommand({
  name: 'whoami',
  description: 'Show the logged-in Weibo account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'user_id', 'screen_name', 'profile_url'],
  examples: ['panerelay weibo whoami'],
  async run(context) {
    return whoami(context);
  },
});
