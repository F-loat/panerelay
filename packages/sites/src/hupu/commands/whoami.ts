import { defineCommand } from '@panerelay/site-kit';
import { whoami } from '../operations.js';
export default defineCommand({
  name: 'whoami',
  description: 'Show the signed-in Hupu account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'user_id', 'username'],
  examples: ['panerelay hupu whoami'],
  async run(context) {
    return whoami(context);
  },
});
