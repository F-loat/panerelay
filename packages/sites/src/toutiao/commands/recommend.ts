import { defineCommand } from '@panerelay/site-kit';
import { CATEGORIES, limit, pick, recommendRow, ToutiaoClient } from '../client.js';
export default defineCommand({
  name: 'recommend',
  description: 'List a public Toutiao recommendation channel.',
  access: 'read',
  args: [
    {
      name: 'category',
      description: 'Recommendation category.',
      type: 'string',
      default: '__all__',
    },
    { name: 'limit', description: 'Maximum articles.', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'group_id',
    'title',
    'abstract',
    'source',
    'tag',
    'comments',
    'published_at',
    'url',
    'image_url',
  ],
  examples: ['panerelay toutiao recommend --category news_tech --limit 10'],
  async run(context, args) {
    const category = String(args.category || '__all__');
    if (!CATEGORIES.includes(category))
      throw new Error(`toutiao category must be one of: ${CATEGORIES.join(', ')}`);
    const body = await new ToutiaoClient(context).get(
      `https://www.toutiao.com/api/pc/feed/?category=${encodeURIComponent(category)}`,
    );
    const data = pick(body, 'data');
    if (!Array.isArray(data)) throw new Error('toutiao recommend returned malformed data');
    const rows = data
      .map((item, index) => recommendRow(item as Record<string, unknown>, index + 1))
      .filter(Boolean)
      .slice(0, limit(args.limit, 20));
    if (!rows.length) throw new Error(`toutiao recommend returned no articles for ${category}`);
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  },
});
