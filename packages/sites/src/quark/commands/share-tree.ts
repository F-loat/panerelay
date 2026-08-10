import { defineCommand } from '@panerelay/site-kit';
import { shareTree } from '../operations.js';

export default defineCommand({
  name: 'share-tree',
  description: 'Read a Quark share as a bounded directory tree.',
  access: 'read',
  args: [
    {
      name: 'url',
      description: 'Share URL or pwd_id.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'passcode', description: 'Optional share passcode.', type: 'string', default: '' },
    { name: 'depth', description: 'Recursive depth (0-10).', type: 'number', default: 10 },
  ],
  output: ['pwd_id', 'stoken', 'tree'],
  examples: ['panerelay quark share-tree https://pan.quark.cn/s/abc123 --depth 2'],
  async run(context, args) {
    return shareTree(context, args);
  },
});
