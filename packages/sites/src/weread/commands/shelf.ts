import { defineCommand } from '@panerelay/site-kit';
import { WereadClient, object, pick, positive, text } from '../client.js';

export default defineCommand({
  name: 'shelf',
  description: 'List books on your WeRead shelf.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum books.', type: 'number', default: 20 }],
  output: ['title', 'author', 'progress', 'bookId'],
  examples: ['panerelay weread shelf --limit 20'],
  async run(context, args) {
    const data = await new WereadClient(context).privateJson('/shelf/sync', {
      synckey: '0',
      lectureSynckey: '0',
    });
    const books = pick(data, 'books');
    return (Array.isArray(books) ? books : [])
      .slice(0, positive(args.limit, 20, 1000, 'limit'))
      .map(raw => {
        const item = object(raw);
        const info = object(pick(item, 'bookInfo'));
        const progress = pick(item, 'readingProgress');
        return {
          title: text(pick(info, 'title') ?? pick(item, 'title')),
          author: text(pick(info, 'author') ?? pick(item, 'author')),
          progress: progress == null ? '-' : `${text(progress)}%`,
          bookId: text(pick(item, 'bookId') ?? pick(info, 'bookId')),
        };
      });
  },
});
