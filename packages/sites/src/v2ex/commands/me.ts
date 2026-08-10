import { defineCommand } from '@panerelay/site-kit';
import { accountFromHtml, V2exClient } from '../client.js';

export default defineCommand({
  name: 'me',
  description: 'Get the logged-in V2EX profile, balance, and unread count.',
  access: 'read',
  args: [],
  output: ['username', 'balance', 'unread_notifications', 'daily_reward_ready'],
  examples: ['panerelay v2ex me'],
  async run(context) {
    return [accountFromHtml(await new V2exClient(context).html('/'))];
  },
});
