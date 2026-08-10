import { defineCommand } from '@panerelay/site-kit';
import { save } from '../operations.js';

export default defineCommand({
  name: 'save',
  description: 'Save shared files to Quark Drive.',
  access: 'write',
  args: [
    {
      name: 'url',
      description: 'Share URL or pwd_id.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'to', description: 'Destination folder path.', type: 'string', default: '' },
    { name: 'to-fid', description: 'Destination folder ID.', type: 'string', default: '' },
    {
      name: 'fids',
      description: 'Optional comma-separated shared file IDs.',
      type: 'string',
      default: '',
    },
    { name: 'stoken', description: 'Share token required with fids.', type: 'string', default: '' },
    { name: 'passcode', description: 'Optional share passcode.', type: 'string', default: '' },
    { name: 'timeout', description: 'Task timeout in seconds.', type: 'number', default: 120 },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: ['success', 'task_id', 'saved_to', 'target_fid', 'fids', 'save_count'],
  examples: ['panerelay quark save https://pan.quark.cn/s/abc123 --to /Shares --execute'],
  async run(context, args) {
    return save(context, args);
  },
});
