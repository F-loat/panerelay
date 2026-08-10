import { defineCommand } from '@panerelay/site-kit';
import { mentions } from '../operations.js';
export default defineCommand({
  name: 'mentions',
  description: 'List replies that mention the signed-in Hupu user.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum messages.', type: 'number', default: 20 },
    { name: 'max-pages', description: 'Maximum pages.', type: 'number', default: 3 },
    { name: 'page-str', description: 'Optional page cursor.', type: 'string' },
  ],
  output: [
    'time',
    'username',
    'thread_title',
    'tid',
    'pid',
    'post_content',
    'quote_content',
    'url',
    'reply_url',
    'topic_id',
    'msg_type',
    'has_next_page',
    'next_page_str',
  ],
  examples: ['panerelay hupu mentions --limit 20'],
  async run(context, args) {
    return mentions(context, args);
  },
});
