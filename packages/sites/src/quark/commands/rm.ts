import { defineCommand } from '@panerelay/site-kit';
import { remove } from '../operations.js';

export default defineCommand({
  name: 'rm',
  description: 'Delete Quark Drive files.',
  access: 'write',
  args: [
    {
      name: 'fids',
      description: 'Comma-separated file IDs.',
      type: 'string',
      positional: true,
      required: true,
    },
    {
      name: 'execute',
      description: 'Confirm the destructive write.',
      type: 'boolean',
      default: false,
    },
  ],
  output: ['status', 'count', 'deleted_fids'],
  examples: ['panerelay quark rm abc123,def456 --execute'],
  async run(context, args) {
    return remove(context, args);
  },
});
