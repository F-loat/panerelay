import { defineCommand } from '@panerelay/site-kit';
import { notifications } from '../operations.js';

export default defineCommand({
  name: 'notifications',
  description: 'List notifications for the signed-in 1point3acres account.',
  access: 'read',
  args: [
    {
      name: 'kind',
      description: 'mypost, interactive, system, or app.',
      type: 'string',
      default: 'mypost',
    },
    { name: 'limit', description: 'Maximum notifications.', type: 'number', default: 20 },
  ],
  output: ['index', 'from', 'summary', 'time', 'threadUrl'],
  examples: ['panerelay 1point3acres notifications --kind interactive --limit 20'],
  async run(context, args) {
    return notifications(context, args);
  },
});
