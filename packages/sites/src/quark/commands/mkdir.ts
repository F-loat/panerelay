import { defineCommand } from '@panerelay/site-kit';
import { mkdir } from '../operations.js';

export default defineCommand({
  name: 'mkdir',
  description: 'Create a Quark Drive folder.',
  access: 'write',
  args: [
    { name: 'name', description: 'Folder name.', type: 'string', positional: true, required: true },
    { name: 'parent', description: 'Parent folder path.', type: 'string' },
    { name: 'parent-fid', description: 'Parent folder ID.', type: 'string' },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: ['status', 'fid', 'name', 'parent'],
  examples: ['panerelay quark mkdir Reports --parent /Documents --execute'],
  async run(context, args) {
    return mkdir(context, args);
  },
});
