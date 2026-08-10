import { defineCommand } from '@panerelay/site-kit';
import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
function text(value: unknown): string {
  return String(value ?? '').trim();
}
export default defineCommand({
  name: 'suggest',
  description: 'Get Google search suggestions.',
  access: 'read',
  args: [
    {
      name: 'keyword',
      description: 'Search prefix.',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'lang', description: 'Language code.', type: 'string', default: 'zh-CN' },
  ],
  output: ['suggestion'],
  examples: ['panerelay google suggest browser --lang en-US'],
  async run(context: SiteCommandContext, args) {
    const keyword = text(args.keyword);
    if (!keyword) throw new Error('google keyword cannot be empty');
    const language = text(args.lang || 'zh-CN');
    const request: BrowserFetchRequest = {
      url: `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(keyword)}&hl=${encodeURIComponent(language)}`,
      responseType: 'json',
      withCookies: false,
    };
    const response = await context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`google suggest failed: HTTP ${response.status}`);
    const body = response.body;
    const values = Array.isArray(body) && Array.isArray(body[1]) ? body[1] : [];
    if (!values.length) throw new Error(`google returned no suggestions for "${keyword}"`);
    return values
      .map(suggestion => ({ suggestion: text(suggestion) }))
      .filter(row => row.suggestion);
  },
});
