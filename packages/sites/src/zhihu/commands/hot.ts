import { defineCommand } from '@panerelay/site-kit';
import { hot } from '../operations.js';

export default defineCommand({
  name: 'hot',
  description: 'List the Zhihu hot ranking.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum items.', type: 'number', default: 20 }],
  output: ['rank', 'title', 'heat', 'answers'],
  examples: ['panerelay zhihu hot --limit 20'],
  async run(context, args) {
    return hot(context, args);
  },
});
