import { defineCommand } from '@panerelay/site-kit';
import { WereadClient, pick, text } from '../client.js';

export default defineCommand({
  name: 'whoami',
  description: 'Show the logged-in WeRead account.',
  access: 'read',
  args: [],
  output: ['logged_in', 'site', 'user_id', 'name'],
  examples: ['panerelay weread whoami'],
  async run(context) {
    const data = await new WereadClient(context).json('/web/user');
    const userId = text(pick(data, 'userVid'));
    if (!userId || [-2010, -2012].includes(Number(pick(data, 'errcode') ?? pick(data, 'errCode'))))
      throw new Error('weread requires a valid logged-in browser session');
    return [
      {
        logged_in: true,
        site: 'weread',
        user_id: userId,
        name: text(pick(data, 'name') ?? pick(data, 'nickName')),
      },
    ];
  },
});
