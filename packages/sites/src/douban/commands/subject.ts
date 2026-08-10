import { defineCommand } from '@panerelay/site-kit';
import { subject } from '../operations.js';
export default defineCommand({
  name: 'subject',
  description: 'Read a Douban movie or book subject.',
  access: 'read',
  args: [
    { name: 'id', description: 'Subject ID.', type: 'string', positional: true, required: true },
    { name: 'type', description: 'movie or book.', type: 'string', default: 'movie' },
  ],
  output: [
    'id',
    'type',
    'title',
    'original_title',
    'authors',
    'publisher',
    'publish_date',
    'isbn',
    'year',
    'rating',
    'rating_count',
    'genres',
    'directors',
    'casts',
    'duration',
    'summary',
    'cover',
    'url',
  ],
  examples: ['panerelay douban subject 1292052'],
  async run(context, args) {
    return subject(context, args);
  },
});
