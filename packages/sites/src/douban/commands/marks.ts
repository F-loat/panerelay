import { defineCommand } from '@panerelay/site-kit';
import { marks } from '../operations.js';
export default defineCommand({
  name: 'marks',
  description: 'Export Douban movie marks.',
  access: 'read',
  args: [
    {
      name: 'status',
      description: 'collect, wish, do, or all.',
      type: 'string',
      default: 'collect',
    },
    {
      name: 'limit',
      description: 'Maximum marks; 0 means all up to safety cap.',
      type: 'number',
      default: 50,
    },
    { name: 'uid', description: 'Douban user ID; defaults to current account.', type: 'string' },
  ],
  output: ['title', 'year', 'my_rating', 'my_status', 'my_date', 'my_comment', 'url'],
  examples: ['panerelay douban marks --status collect --limit 50'],
  async run(context, args) {
    return marks(context, args);
  },
});
