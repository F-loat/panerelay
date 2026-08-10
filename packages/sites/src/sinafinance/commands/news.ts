import { defineCommand } from '@panerelay/site-kit';
import type { BrowserFetchRequest } from '@panerelay/site-kit';
const TYPES = [0, 10, 1, 3, 4, 5, 102, 6, 6, 8];
function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}
export default defineCommand({
  name: 'news',
  description: 'List Sina Finance 7x24 live news.',
  access: 'read',
  args: [
    { name: 'limit', description: 'Maximum items.', type: 'number', default: 20 },
    { name: 'type', description: 'Type 0-9.', type: 'number', default: 0 },
  ],
  output: ['id', 'time', 'content', 'views'],
  examples: ['panerelay sinafinance news --limit 10'],
  async run(context, args) {
    const limit = args.limit == null || args.limit === '' ? 20 : Number(args.limit);
    const type = args.type == null || args.type === '' ? 0 : Number(args.type);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50)
      throw new Error('sinafinance limit must be 1-50');
    if (!Number.isInteger(type) || type < 0 || type > 9)
      throw new Error('sinafinance type must be 0-9');
    const request: BrowserFetchRequest = {
      url: `https://app.cj.sina.com.cn/api/news/pc?page=1&size=${limit}&tag=${TYPES[type]}`,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`sinafinance news failed: HTTP ${response.status}`);
    const rows = pick(pick(pick(pick(response.body, 'result'), 'data'), 'feed'), 'list');
    if (!Array.isArray(rows) || !rows.length) throw new Error('sinafinance news returned no items');
    return rows.map(item => ({
      id: pick(item, 'id') ?? '',
      time: pick(item, 'create_time') ?? '',
      content: String(pick(item, 'rich_text') ?? '')
        .replace(/<[^>]+>/g, '')
        .trim(),
      views: pick(item, 'view_num') ?? 0,
    }));
  },
});
