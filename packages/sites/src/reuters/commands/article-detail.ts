import { defineCommand } from '@panerelay/site-kit';
import { articleDetail } from '../operations.js';

export default defineCommand({
  name: 'article-detail',
  description: 'Read a Reuters article inline.',
  access: 'read',
  args: [
    {
      name: 'url',
      description: 'Reuters article URL.',
      type: 'string',
      positional: true,
      required: true,
    },
  ],
  output: [
    'title',
    'date',
    'section',
    'section_path',
    'authors',
    'description',
    'word_count',
    'url',
    'body',
  ],
  examples: ['panerelay reuters article-detail https://www.reuters.com/world/example/'],
  async run(context, args) {
    return articleDetail(context, args);
  },
});
