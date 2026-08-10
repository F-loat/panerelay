import { defineCommand } from '@panerelay/site-kit';
import { accountFromHtml, V2exClient } from '../client.js';

export default defineCommand({
  name: 'whoami',
  description: 'Show the logged-in V2EX account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'username'],
  examples: ['panerelay v2ex whoami'],
  async run(context) {
    const account = accountFromHtml(await new V2exClient(context).html('/'));
    return [{ logged_in: true, site: 'v2ex', username: account.username }];
  },
});
