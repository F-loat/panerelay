import { defineCommand } from '@panerelay/site-kit';
import { download } from '../operations.js';
export default defineCommand({
  name: 'download',
  description: 'Return Instagram media URLs, with optional inline base64 for one image.',
  access: 'read',
  args: [
    {
      name: 'url',
      description: 'Instagram post, reel, or tv URL.',
      type: 'string',
      positional: true,
      required: true,
    },
    {
      name: 'path',
      description: 'Compatibility placeholder; no local path is written.',
      type: 'string',
      default: '~/Downloads/Instagram',
    },
    { name: 'inline', description: 'Inline one image as base64.', type: 'boolean', default: false },
  ],
  output: ['index', 'shortcode', 'owner', 'type', 'url', 'filename', 'status', 'content_base64'],
  examples: ['panerelay instagram download https://www.instagram.com/p/SHORTCODE/'],
  async run(context, args) {
    return download(context, args);
  },
});
