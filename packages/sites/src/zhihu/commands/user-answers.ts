import { defineCommand } from '@panerelay/site-kit';
import { userAnswers } from '../operations.js';

export default defineCommand({
  name: 'user-answers',
  description: 'List answers posted by a Zhihu user.',
  access: 'read',
  args: [
    {
      name: 'user',
      description: 'User url_token or people URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum answers.', type: 'number', default: 20 },
  ],
  output: ['rank', 'question', 'votes', 'comments', 'created', 'url'],
  examples: ['panerelay zhihu user-answers wen-jie-16-47 --limit 20'],
  async run(context, args) {
    return userAnswers(context, args);
  },
});
