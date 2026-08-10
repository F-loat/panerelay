import { defineCommand } from '@panerelay/site-kit';
import { me } from '../operations.js';
export default defineCommand({
  name: 'me',
  description: 'Get the logged-in Weibo profile.',
  access: 'read',
  args: [],
  output: ['screen_name', 'uid', 'followers', 'following', 'statuses', 'verified', 'location'],
  examples: ['panerelay weibo me'],
  async run(context) {
    return me(context);
  },
});
