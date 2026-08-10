import { defineCommand } from '@panerelay/site-kit';
import { runList } from '../list.js';

export default defineCommand({
  name: 'latest',
  description: 'Fetch newest DEV.to articles.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Number of articles', type: 'number', default: 20 },
    { name: 'page', description: '1-based page number', type: 'number', default: 1 },
  ],
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
  examples: ['panerelay devto latest'],
  run: (context, args) => runList(context, args, 'latest'),
});
