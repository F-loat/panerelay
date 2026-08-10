import { defineCommand } from '@panerelay/site-kit';
import { hot } from '../operations.js';
export default defineCommand({
  name: 'hot',
  description: 'List Hupu home-page threads.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum threads.', type: 'number', default: 20 }],
  output: ['rank', 'tid', 'title', 'lights', 'replies', 'forum', 'is_hot', 'url'],
  examples: ['panerelay hupu hot --limit 20'],
  async run(context, args) {
    return hot(context, args);
  },
});
