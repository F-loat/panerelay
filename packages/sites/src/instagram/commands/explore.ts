import { defineCommand } from '@panerelay/site-kit';
import { explore } from '../operations.js';
export default defineCommand({
  name: 'explore',
  description: 'List Instagram Explore posts.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum posts.', type: 'number', default: 20 }],
  output: ['rank', 'user', 'caption', 'likes', 'comments', 'type', 'code', 'url'],
  examples: ['panerelay instagram explore'],
  async run(context, args) {
    return explore(context, args);
  },
});
