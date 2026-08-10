import { defineCommand } from '@panerelay/site-kit';
import { object, pick, responseData, text, ZsxqClient } from '../client.js';

export default defineCommand({
  name: 'whoami',
  description: 'Show the current ZSXQ account.',
  access: 'read',
  args: [],
  output: ['user_id', 'name'],
  examples: ['panerelay zsxq whoami'],
  async run(context) {
    const user = object(
      pick(responseData(await new ZsxqClient(context).get('/v2/users/self')), 'user'),
    );
    const userId = text(pick(user, 'user_id') ?? pick(user, 'id'));
    if (!userId) throw new Error('zsxq requires a valid logged-in browser session');
    return [{ user_id: userId, name: text(pick(user, 'name') ?? pick(user, 'nickname')) }];
  },
});
