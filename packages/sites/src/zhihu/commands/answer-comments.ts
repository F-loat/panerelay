import { defineCommand } from '@panerelay/site-kit';
import { answerComments } from '../operations.js';

export default defineCommand({
  name: 'answer-comments',
  description: 'List comments and replies on a Zhihu answer.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Answer ID, URL, or answer:<question-id>:<answer-id>.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Top-level comments.', type: 'number', default: 20 },
    {
      name: 'replies-limit',
      description: 'Replies per top-level comment.',
      type: 'number',
      default: 3,
    },
  ],
  output: [
    'rank',
    'comment_rank',
    'reply_rank',
    'depth',
    'id',
    'parent_id',
    'author',
    'reply_to',
    'likes',
    'created_at',
    'url',
    'content',
  ],
  examples: ['panerelay zhihu answer-comments 1937205528846655537 --limit 20'],
  async run(context, args) {
    return answerComments(context, args);
  },
});
