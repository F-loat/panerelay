import { defineCommand } from '@panerelay/site-kit';
import { articleUpdate } from '../operations.js';

export default defineCommand({
  name: 'article-update',
  description: 'Update and verify an owned Zhihu article draft without publishing it.',
  access: 'write',
  args: [
    {
      name: 'target',
      description: 'Article URL or article:<id>.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'title', description: 'Replacement title.', type: 'string' },
    { name: 'content', description: 'Replacement inline HTML.', type: 'string' },
    { name: 'execute', description: 'Confirm the draft update.', type: 'boolean' },
  ],
  output: [
    'status',
    'outcome',
    'message',
    'id',
    'title',
    'content',
    'state',
    'author_identity',
    'created_at',
    'updated_at',
    'url',
    'editor_url',
  ],
  examples: [
    'panerelay zhihu article-update article:123 --title "New title" --execute',
    'panerelay zhihu article-update https://zhuanlan.zhihu.com/p/123 --content "<p>New body</p>" --execute',
  ],
  async run(context, args) {
    return articleUpdate(context, args);
  },
});
