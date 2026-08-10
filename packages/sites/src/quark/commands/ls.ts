import { defineCommand } from '@panerelay/site-kit';
import { list } from '../operations.js';

export default defineCommand({
  name: 'ls',
  description: 'List files in Quark Drive.',
  access: 'read',
  args: [
    { name: 'path', description: 'Folder path.', type: 'string', positional: true, default: '' },
    { name: 'depth', description: 'Recursive depth (0-10).', type: 'number', default: 0 },
    { name: 'dirs-only', description: 'Return directories only.', type: 'boolean', default: false },
  ],
  output: ['name', 'is_dir', 'size', 'fid', 'path'],
  examples: ['panerelay quark ls /Documents --depth 1'],
  async run(context, args) {
    return list(context, args);
  },
});
