import { defineCommand } from '@panerelay/site-kit';
import { rename } from '../operations.js';

export default defineCommand({
  name: 'rename',
  description: 'Rename a Quark Drive file.',
  access: 'write',
  args: [
    { name: 'fid', description: 'File ID.', type: 'string', positional: true, required: true },
    { name: 'name', description: 'New file name.', type: 'string', required: true },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: ['status', 'fid', 'new_name'],
  examples: ['panerelay quark rename abc123 --name report.pdf --execute'],
  async run(context, args) {
    return rename(context, args);
  },
});
