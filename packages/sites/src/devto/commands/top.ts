import { defineCommand } from '@panerelay/site-kit';
import { runList } from '../list.js';

export default defineCommand({
  name: 'top',
  description: 'Fetch top DEV.to articles.',
  access: 'read',
  args: [{ name: 'limit', description: 'Number of articles', type: 'number', default: 20 }],
  output: [
    'rank',
    'id',
    'title',
    'author',
    'reactions',
    'comments',
    'readingTime',
    'published',
    'tags',
    'url',
  ],
  examples: ['panerelay devto top'],
  run: (context, args) => runList(context, args, 'top'),
});
