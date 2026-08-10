import { defineCommand } from '@panerelay/site-kit';
import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
function text(value: unknown): string {
  return String(value ?? '').trim();
}
export default defineCommand({
  name: 'suggest',
  description: 'Get DuckDuckGo search suggestions.',
  access: 'read',
  args: [
    {
      name: 'keyword',
      description: 'Search prefix.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'limit', description: 'Maximum suggestions (1-20).', type: 'number', default: 8 },
  ],
  output: ['phrase'],
  examples: ['panerelay duckduckgo suggest browser'],
  async run(context: SiteCommandContext, args) {
    const keyword = text(args.keyword);
    if (!keyword) throw new Error('duckduckgo keyword cannot be empty');
    const limit = args.limit == null || args.limit === '' ? 8 : Number(args.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new Error('duckduckgo limit must be an integer between 1 and 20');
    const request: BrowserFetchRequest = {
      url: `https://duckduckgo.com/ac/?q=${encodeURIComponent(keyword)}&type=list`,
      responseType: 'json',
      withCookies: false,
    };
    const response = await context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`duckduckgo suggest failed: HTTP ${response.status}`);
    const body = response.body;
    const values = Array.isArray(body) && Array.isArray(body[1]) ? body[1] : [];
    return values
      .filter(value => typeof value === 'string' && value.trim())
      .slice(0, limit)
      .map(phrase => ({ phrase }));
  },
});
