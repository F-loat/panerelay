import { defineCommand } from '@panerelay/site-kit';
import { answerDetail } from '../operations.js';

export default defineCommand({
  name: 'answer-detail',
  description: 'Get one Zhihu answer with full stripped content.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Answer ID, URL, or answer:<question-id>:<answer-id>.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'max-content',
      description: 'Maximum content characters; 0 returns all.',
      type: 'number',
      default: 0,
    },
  ],
  output: [
    'id',
    'author',
    'votes',
    'comments',
    'question_id',
    'question_title',
    'url',
    'created_at',
    'updated_at',
    'content',
  ],
  examples: ['panerelay zhihu answer-detail 1937205528846655537'],
  async run(context, args) {
    return answerDetail(context, args);
  },
});
