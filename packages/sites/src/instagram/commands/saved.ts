import { defineCommand } from '@panerelay/site-kit';
import { saved } from '../operations.js';
export default defineCommand({
  name: 'saved',
  description: 'List saved Instagram posts.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum posts.', type: 'number', default: 20 },
    { name: 'collection', description: 'Optional collection name.', type: 'string' },
  ],
  output: ['index', 'user', 'caption', 'likes', 'comments', 'type', 'code', 'url'],
  examples: ['panerelay instagram saved --limit 20'],
  async run(context, args) {
    return saved(context, args);
  },
});
