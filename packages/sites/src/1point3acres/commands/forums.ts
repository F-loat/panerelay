import { defineCommand } from '@panerelay/site-kit';
import { forums } from '../operations.js';

export default defineCommand({
  name: 'forums',
  description: 'List 1point3acres forum IDs and names.',
  access: 'read',
  args: [{ name: 'filter', description: 'Optional forum-name substring.', type: 'string' }],
  output: ['fid', 'name', 'url'],
  examples: ['panerelay 1point3acres forums --filter interview'],
  async run(context, args) {
    return forums(context, args);
  },
});
