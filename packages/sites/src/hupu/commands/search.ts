import { defineCommand } from '@panerelay/site-kit';
import { search } from '../operations.js';
export default defineCommand({
  name: 'search',
  description: 'Search Hupu threads.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search query.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'page', description: 'Page number.', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum results.', type: 'number', default: 20 },
    { name: 'forum', description: 'Optional forum ID.', type: 'string' },
    { name: 'sort', description: 'Sort mode.', type: 'string', default: 'general' },
  ],
  output: ['rank', 'tid', 'title', 'author', 'replies', 'lights', 'forum', 'url'],
  examples: ['panerelay hupu search NBA --limit 20'],
  async run(context, args) {
    return search(context, args);
  },
});
