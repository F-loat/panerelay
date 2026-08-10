import { defineCommand } from '@panerelay/site-kit';
import { hot } from '../operations.js';

export default defineCommand({
  name: 'hot',
  description: 'List Tieba hot topics.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum topics (1-20).', type: 'number', default: 20 }],
  output: ['rank', 'title', 'discussions', 'description', 'url'],
  examples: ['panerelay tieba hot --limit 10'],
  async run(context, args) {
    return hot(context, args);
  },
});
