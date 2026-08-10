import { defineCommand } from '@panerelay/site-kit';
import { download } from '../operations.js';
export default defineCommand({
  name: 'download',
  description: 'Return Douban photo URLs, or inline base64 for one selected photo.',
  access: 'read',
  args: [
    { name: 'id', description: 'Subject ID.', type: 'string', positional: true, required: true },
    { name: 'type', description: 'Photo type.', type: 'string', default: 'Rb' },
    { name: 'limit', description: 'Maximum resources.', type: 'number', default: 120 },
    { name: 'photo-id', description: 'Select one photo for inline base64.', type: 'string' },
    {
      name: 'output',
      description: 'Compatibility placeholder; no local file is written.',
      type: 'string',
      default: './douban-downloads',
    },
  ],
  output: ['index', 'photo_id', 'title', 'status', 'size', 'image_url', 'content_base64'],
  examples: ['panerelay douban download 1292052 --photo-id 123456'],
  async run(context, args) {
    return download(context, args);
  },
});
