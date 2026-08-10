import { defineCommand } from '@panerelay/site-kit';
import { feed } from '../operations.js';
export default defineCommand({
  name: 'feed',
  description: 'Get the logged-in Weibo timeline.',
  access: 'read',
  args: [
    { name: 'type', description: 'for-you or following.', type: 'string', default: 'for-you' },
    { name: 'limit', description: 'Maximum posts.', type: 'number', default: 15 },
  ],
  output: ['id', 'author', 'text', 'reposts', 'comments', 'likes', 'time', 'url'],
  examples: ['panerelay weibo feed --type following'],
  async run(context, args) {
    return feed(context, args);
  },
});
