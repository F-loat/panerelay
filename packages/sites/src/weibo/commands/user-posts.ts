import { defineCommand } from '@panerelay/site-kit';
import { userPosts } from '../operations.js';
export default defineCommand({
  name: 'user-posts',
  description: 'List posts from a Weibo user.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Numeric uid or screen name.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'start', description: 'Start date YYYY-MM-DD.', type: 'string' },
    { name: 'end', description: 'End date YYYY-MM-DD.', type: 'string' },
    { name: 'limit', description: 'Maximum posts.', type: 'number', default: 20 },
    { name: 'include-retweets', description: 'Include retweets.', type: 'boolean', default: false },
  ],
  output: [
    'rank',
    'id',
    'mblogid',
    'author',
    'uid',
    'text',
    'time',
    'reposts',
    'comments',
    'likes',
    'pic_count',
    'url',
  ],
  examples: ['panerelay weibo user-posts 123456 --limit 20'],
  async run(context, args) {
    return userPosts(context, args);
  },
});
