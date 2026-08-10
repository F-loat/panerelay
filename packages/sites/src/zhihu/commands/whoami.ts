import { defineCommand } from '@panerelay/site-kit';
import { whoami } from '../operations.js';

export default defineCommand({
  name: 'whoami',
  description: 'Show the logged-in Zhihu account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'url_token', 'name', 'uid'],
  examples: ['panerelay zhihu whoami'],
  async run(context) {
    return whoami(context);
  },
});
