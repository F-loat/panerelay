import { defineCommand } from '@panerelay/site-kit';
import { whoami } from '../operations.js';
export default defineCommand({
  name: 'whoami',
  description: 'Show the signed-in Douban account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'user_id', 'name', 'url'],
  examples: ['panerelay douban whoami'],
  async run(context) {
    return whoami(context);
  },
});
