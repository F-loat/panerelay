import { defineCommand } from '@panerelay/site-kit';
import { articleDraft } from '../operations.js';

export default defineCommand({
  name: 'article-draft',
  description: 'Read the complete editable state of an owned Zhihu article draft.',
  access: 'read',
  args: [
    {
      name: 'target',
      description: 'Article URL or article:<id>.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
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
  examples: ['panerelay zhihu article-draft article:123'],
  async run(context, args) {
    return articleDraft(context, args);
  },
});
