import { defineCommand } from '@panerelay/site-kit';
import { profile } from '../operations.js';
export default defineCommand({
  name: 'profile',
  description: 'Read a Google Scholar author profile.',
  access: 'read',
  args: [
    {
      name: 'author',
      description: 'Author name or 12-character user ID.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'limit', description: 'Maximum papers.', type: 'number', default: 10 },
  ],
  output: ['rank', 'title', 'cited', 'year'],
  examples: ['panerelay google-scholar profile JicYPdAAAAAJ'],
  async run(context, args) {
    return profile(context, args);
  },
});
