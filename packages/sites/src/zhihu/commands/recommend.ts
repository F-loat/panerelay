import { defineCommand } from '@panerelay/site-kit';
import { recommend } from '../operations.js';

export default defineCommand({
  name: 'recommend',
  description: 'List personalized Zhihu recommendations.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum items.', type: 'number', default: 20 }],
  output: ['rank', 'type', 'title', 'author', 'votes', 'url'],
  examples: ['panerelay zhihu recommend --limit 20'],
  async run(context, args) {
    return recommend(context, args);
  },
});
