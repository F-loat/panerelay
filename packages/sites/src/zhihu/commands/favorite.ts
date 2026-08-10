import { defineCommand } from '@panerelay/site-kit';
import { favorite } from '../operations.js';

export default defineCommand({
  name: 'favorite',
  description: 'Favorite a Zhihu answer or article.',
  access: 'write',
  args: [
    {
      name: 'target',
      description: 'Answer/article URL or typed target.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'collection', description: 'Collection name.', type: 'string' },
    { name: 'collection-id', description: 'Stable collection ID.', type: 'string' },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: [
    'status',
    'outcome',
    'message',
    'target_type',
    'target',
    'collection_name',
    'collection_id',
  ],
  examples: ['panerelay zhihu favorite answer:123:456 --collection-id 789 --execute'],
  async run(context, args) {
    return favorite(context, args);
  },
});
