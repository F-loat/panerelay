import { defineCommand } from '@panerelay/site-kit';
import { userArticles } from '../operations.js';

export default defineCommand({
  name: 'user-articles',
  description: 'List articles posted by a Zhihu user.',
  access: 'read',
  args: [
    {
      name: 'user',
      description: 'User url_token or people URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum articles.', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'votes', 'comments', 'created', 'url'],
  examples: ['panerelay zhihu user-articles wen-jie-16-47 --limit 20'],
  async run(context, args) {
    return userArticles(context, args);
  },
});
