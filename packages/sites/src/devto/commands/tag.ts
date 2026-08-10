import { defineCommand } from '@panerelay/site-kit';
import { runList } from '../list.js';

export default defineCommand({
  name: 'tag',
  description: 'Fetch latest DEV.to articles for a tag.',
  access: 'read',
  args: [
    { name: 'tag', description: 'DEV.to tag', type: 'string', required: true, positional: true },
    { name: 'limit', description: 'Number of articles', type: 'number', default: 20 },
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
  examples: ['panerelay devto tag javascript'],
  run: (context, args) => runList(context, args, 'tag', 'tag'),
});
