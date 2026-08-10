import { defineCommand } from '@panerelay/site-kit';
import { JuejinClient, bounded, cursor, dataRows, feedRow, pick, text } from '../client.js';

export default defineCommand({
  name: 'recommend',
  description: 'List Juejin recommended articles.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum articles (1-100).', type: 'number', default: 20 },
    { name: 'cursor', description: 'Pagination cursor.', type: 'string', default: '0' },
  ],
  output: [
    'rank',
    'article_id',
    'title',
    'brief',
    'views',
    'likes',
    'comments',
    'author',
    'tags',
    'url',
    'next_cursor',
    'has_more',
  ],
  examples: ['panerelay juejin recommend --limit 5'],
  async run(context, args) {
    const limit = bounded(args.limit, 20, 100);
    const next = cursor(args.cursor);
    const payload = await new JuejinClient(context).request(
      '/recommend_api/v1/article/recommend_all_feed',
      { id_type: 2, client_type: 2608, sort_type: 200, limit, cursor: next },
    );
    const nextCursor = text(pick(payload, 'cursor'));
    const hasMore = Boolean(pick(payload, 'has_more'));
    return dataRows(payload, 'juejin recommend')
      .slice(0, limit)
      .map((row, index) => ({
        ...feedRow(row, index + 1),
        next_cursor: nextCursor,
        has_more: String(hasMore),
      }));
  },
});
