import { defineCommand } from '@panerelay/site-kit';
import { answer } from '../operations.js';

export default defineCommand({
  name: 'answer',
  description: 'Answer a Zhihu question.',
  access: 'write',
  args: [
    {
      name: 'target',
      description: 'Question URL or question:<id>.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'text', description: 'Answer text.', type: 'string', positional: true },
    { name: 'file', description: 'Unsupported local text path; use inline text.', type: 'string' },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: [
    'status',
    'outcome',
    'message',
    'target_type',
    'target',
    'created_target',
    'created_url',
    'author_identity',
  ],
  examples: ['panerelay zhihu answer question:123 "Answer" --execute'],
  async run(context, args) {
    return answer(context, args);
  },
});
