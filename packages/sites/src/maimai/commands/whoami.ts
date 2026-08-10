import { defineCommand } from '@panerelay/site-kit';
import { whoami } from '../operations.js';
export default defineCommand({
  name: 'whoami',
  description: 'Show the signed-in Maimai account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'user_id', 'name', 'company'],
  examples: ['panerelay maimai whoami'],
  async run(context) {
    return whoami(context);
  },
});
