import { defineCommand } from '@panerelay/site-kit';
import { JuejinClient, bounded, category, dataRows, hotRow } from '../client.js';

export default defineCommand({
  name: 'hot',
  description: 'List Juejin hot articles, optionally scoped to a category.',
  access: 'read',
  args: [
    {
      name: 'category',
      description: 'Category id or slug: backend, frontend, android, ios, or ai.',
      type: 'string',
    },
    { name: 'limit', description: 'Maximum articles (1-50).', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'article_id',
    'title',
    'brief',
    'views',
    'likes',
    'comments',
    'hot_rank',
    'author',
    'url',
  ],
  examples: ['panerelay juejin hot --limit 5'],
  async run(context, args) {
    const payload = await new JuejinClient(context).request(
      `/content_api/v1/content/article_rank?category_id=${encodeURIComponent(category(args.category))}&type=hot`,
    );
    return dataRows(payload, 'juejin hot')
      .slice(0, bounded(args.limit, 20, 50))
      .map((row, index) => hotRow(row, index + 1));
  },
});
