import { defineCommand } from '@panerelay/site-kit';
import { runList } from '../list.js';

export default defineCommand({
  name: 'user',
  description: 'Fetch recent DEV.to articles from a user.',
  access: 'read',
  args: [
    {
      name: 'username',
      description: 'DEV.to username',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Number of articles', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'id',
    'title',
    'reactions',
    'comments',
    'readingTime',
    'published',
    'tags',
    'url',
  ],
  examples: ['panerelay devto user ben'],
  run: (context, args) => runList(context, args, 'user', 'username'),
});
