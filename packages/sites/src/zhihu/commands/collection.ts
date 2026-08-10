import { defineCommand } from '@panerelay/site-kit';
import { collection } from '../operations.js';

export default defineCommand({
  name: 'collection',
  description: 'List items in a logged-in Zhihu collection.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Numeric collection ID.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'offset', description: 'Starting offset.', type: 'number', default: 0 },
    { name: 'limit', description: 'Maximum items.', type: 'number', default: 20 },
  ],
  output: ['rank', 'type', 'title', 'author', 'votes', 'excerpt', 'url'],
  examples: ['panerelay zhihu collection 83283292 --limit 20'],
  async run(context, args) {
    return collection(context, args);
  },
});
