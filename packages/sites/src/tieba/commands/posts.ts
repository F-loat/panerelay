import { defineCommand } from '@panerelay/site-kit';
import { posts } from '../operations.js';

export default defineCommand({
  name: 'posts',
  description: 'Browse posts in a Tieba forum.',
  access: 'read',
  args: [
    { name: 'forum', description: 'Forum name.', type: 'string', positional: true, required: true },
    { name: 'page', description: 'Page number.', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum posts (1-20).', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'author', 'replies', 'id', 'url'],
  examples: ['panerelay tieba posts 编程 --limit 10'],
  async run(context, args) {
    return posts(context, args);
  },
});
