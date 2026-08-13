import { defineCommand } from '@panerelay/site-kit';
import { articleCreate } from '../operations.js';

export default defineCommand({
  name: 'article-create',
  description: 'Create and verify a private Zhihu article draft.',
  access: 'write',
  args: [
    {
      name: 'title',
      description: 'Draft title (up to 300 UTF-8 bytes).',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'content',
      description: 'Inline draft HTML (up to 1,000,000 UTF-8 bytes).',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'execute', description: 'Confirm the private draft creation.', type: 'boolean' },
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
  examples: ['panerelay zhihu article-create "Draft title" "<p>Draft body</p>" --execute'],
  async run(context, args) {
    return articleCreate(context, args);
  },
});
