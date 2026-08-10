import { defineCommand } from '@panerelay/site-kit';
import { guide } from '../operations.js';

export default defineCommand({
  name: 'latest',
  description: 'List the newest 1point3acres threads.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum threads.', type: 'number', default: 20 }],
  output: ['rank', 'tid', 'title', 'forum', 'author', 'replies', 'views', 'postTime', 'url'],
  examples: ['panerelay 1point3acres latest --limit 10'],
  async run(context, args) {
    return guide(context, args, 'new');
  },
});
