import { defineCommand } from '@panerelay/site-kit';
import { move } from '../operations.js';

export default defineCommand({
  name: 'mv',
  description: 'Move Quark Drive files.',
  access: 'write',
  args: [
    {
      name: 'fids',
      description: 'Comma-separated file IDs.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'to', description: 'Destination folder path.', type: 'string', default: '' },
    { name: 'to-fid', description: 'Destination folder ID.', type: 'string', default: '' },
    { name: 'timeout', description: 'Task timeout in seconds.', type: 'number', default: 120 },
    { name: 'execute', description: 'Confirm the write.', type: 'boolean', default: false },
  ],
  output: ['status', 'count', 'destination', 'task_id', 'completed'],
  examples: ['panerelay quark mv abc123 --to /Archive --execute'],
  async run(context, args) {
    return move(context, args);
  },
});
