import { defineCommand, type BrowserFetchRequest } from '@panerelay/site-kit';

type Value = Record<string, unknown>;
function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
function text(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default defineCommand({
  name: 'search',
  description: 'Search public Sina Blog articles through Sina Search.',
  access: 'read',
  args: [
    {
      name: 'keyword',
      description: 'Search keyword.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum articles.', type: 'number', default: 20 },
  ],
  output: ['rank', 'title', 'author', 'date', 'description', 'url'],
  examples: ['panerelay sinablog search 人工智能 --limit 10'],
  async run(context, args) {
    const keyword = text(args.keyword);
    if (!keyword) throw new Error('sinablog keyword cannot be empty');
    const take = Math.max(1, Math.min(Number(args.limit) || 20, 50));
    const url = new URL('https://search.sina.com.cn/api/search');
    for (const [key, value] of Object.entries({
      q: keyword,
      tp: 'mix',
      sort: '0',
      page: '1',
      size: String(Math.max(take, 10)),
      from: 'search_result',
    }))
      url.searchParams.set(key, value);
    const request: BrowserFetchRequest = {
      url: url.toString(),
      method: 'GET',
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`sinablog search failed: HTTP ${response.status}`);
    const list = pick(pick(response.body, 'data'), 'list');
    if (!Array.isArray(list)) throw new Error('sinablog search returned an unexpected payload');
    const rows = list
      .filter(item => text(pick(item, 'url')).includes('blog.sina.com.cn/s/blog_'))
      .slice(0, take)
      .map((item, index) => ({
        rank: index + 1,
        title: text(pick(item, 'title')),
        author: text(pick(item, 'media_show') || pick(item, 'author')),
        date: text(pick(item, 'time') || pick(item, 'dataTime')),
        description: text(pick(item, 'intro') || pick(item, 'searchSummary')).slice(0, 150),
        url: text(pick(item, 'url')),
      }));
    if (!rows.length) throw new Error(`sinablog returned no articles for "${keyword}"`);
    return rows;
  },
});
