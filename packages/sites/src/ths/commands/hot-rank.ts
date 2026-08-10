import { defineCommand } from '@panerelay/site-kit';
import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
type Value = Record<string, unknown>;
function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export default defineCommand({
  name: 'hot-rank',
  description: 'List the public Tonghuashun hot-stock ranking.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum stocks (1-100).', type: 'number', default: 20 }],
  output: ['rank', 'name', 'changePercent', 'heat', 'tags'],
  examples: ['panerelay ths hot-rank --limit 10'],
  async run(context: SiteCommandContext, args) {
    const limit = args.limit == null || args.limit === '' ? 20 : Number(args.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error('ths limit must be an integer between 1 and 100');
    const request: BrowserFetchRequest = {
      url: 'https://dq.10jqka.com.cn/fuyao/hot_list_data/out/hot_list/v1/stock?stock_type=a&type=hour&list_type=normal',
      headers: { accept: 'application/json', referer: 'https://eq.10jqka.com.cn/' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`ths hot-rank failed: HTTP ${response.status}`);
    const stocks = pick(pick(response.body, 'data'), 'stock_list');
    if (!Array.isArray(stocks) || !stocks.length)
      throw new Error('ths hot-rank returned no stock data');
    return stocks.slice(0, limit).map((stock, index) => {
      const tag = pick(stock, 'tag');
      const concepts = Array.isArray(pick(tag, 'concept_tag'))
        ? (pick(tag, 'concept_tag') as unknown[])
        : [];
      const popularity = Array.isArray(pick(tag, 'popularity_tag'))
        ? (pick(tag, 'popularity_tag') as unknown[])
        : [];
      return {
        rank: Number(pick(stock, 'order')) || index + 1,
        name: String(pick(stock, 'name') || ''),
        changePercent: pick(stock, 'rise_and_fall') ?? '',
        heat: pick(stock, 'rate') ?? '',
        tags: [...concepts, ...popularity].filter(Boolean).join(','),
      };
    });
  },
});
