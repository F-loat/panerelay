import { defineCommand } from '@panerelay/site-kit';
import { collections } from '../operations.js';

export default defineCommand({
  name: 'collections',
  description: 'List the logged-in Zhihu account collections.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum collections.', type: 'number', default: 20 }],
  output: ['rank', 'title', 'item_count', 'description', 'collection_id'],
  examples: ['panerelay zhihu collections --limit 20'],
  async run(context, args) {
    return collections(context, args);
  },
});
