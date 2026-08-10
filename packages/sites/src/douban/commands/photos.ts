import { defineCommand } from '@panerelay/site-kit';
import { photos } from '../operations.js';
export default defineCommand({
  name: 'photos',
  description: 'List Douban subject photo resources.',
  access: 'read',
  args: [
    { name: 'id', description: 'Subject ID.', type: 'string', positional: true, required: true },
    { name: 'type', description: 'Photo type.', type: 'string', default: 'Rb' },
    { name: 'limit', description: 'Maximum photos.', type: 'number', default: 120 },
  ],
  output: [
    'index',
    'photo_id',
    'subject_id',
    'title',
    'image_url',
    'thumb_url',
    'detail_url',
    'page',
  ],
  examples: ['panerelay douban photos 1292052 --limit 10'],
  async run(context, args) {
    return photos(context, args);
  },
});
