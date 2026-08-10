import { defineCommand } from '@panerelay/site-kit';
import { hot } from '../operations.js';
export default defineCommand({
  name: 'hot',
  description: 'List Weibo hot searches.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum topics.', type: 'number', default: 30 }],
  output: ['rank', 'word', 'hot_value', 'category', 'label', 'url'],
  examples: ['panerelay weibo hot --limit 30'],
  async run(context, args) {
    return hot(context, args);
  },
});
