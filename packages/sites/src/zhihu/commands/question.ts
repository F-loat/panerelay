import { defineCommand } from '@panerelay/site-kit';
import { question } from '../operations.js';

export default defineCommand({
  name: 'question',
  description: 'List answers to a Zhihu question.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Numeric question ID.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum answers.', type: 'number', default: 5 },
    {
      name: 'sort',
      description: 'Answer order: default or created.',
      type: 'string',
      default: 'default',
    },
  ],
  output: ['rank', 'id', 'author', 'votes', 'url', 'content'],
  examples: ['panerelay zhihu question 123456789 --limit 5'],
  async run(context, args) {
    return question(context, args);
  },
});
