import { defineCommand } from '@panerelay/site-kit';
import { FEEDS } from '../client.js';
export default defineCommand({
  name: 'feeds',
  description: 'List public Bloomberg RSS feed aliases.',
  access: 'read',
  args: [],
  output: ['name', 'url'],
  examples: ['panerelay bloomberg feeds'],
  async run() {
    return Object.entries(FEEDS).map(([name, url]) => ({ name, url }));
  },
});
