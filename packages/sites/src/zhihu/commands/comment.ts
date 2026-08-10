import { defineCommand } from '@panerelay/site-kit';
import { comment } from '../operations.js';

export default defineCommand({
  name: 'comment',
  description: 'Post a top-level comment on a Zhihu answer or article.',
  access: 'write',
  args: [
    {
      name: 'target',
      description: 'Answer/article URL or typed target.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'text', description: 'Comment text.', type: 'string', positional: true },
    { name: 'file', description: 'Unsupported local text path; use inline text.', type: 'string' },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: [
    'status',
    'outcome',
    'message',
    'target_type',
    'target',
    'author_identity',
    'created_url',
  ],
  examples: ['panerelay zhihu comment answer:123:456 "Comment" --execute'],
  async run(context, args) {
    return comment(context, args);
  },
});
