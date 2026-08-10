import { defineCommand, SiteError, type BrowserFetchRequest } from '@panerelay/site-kit';

function clean(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default defineCommand({
  name: 'news',
  description: 'List UISDC design and AI news.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum items.', type: 'number', default: 20 }],
  output: ['rank', 'title', 'summary', 'url'],
  examples: ['panerelay uisdc news --limit 20'],
  async run(context, args) {
    const limit = Number(args.limit ?? 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50)
      throw new Error('uisdc limit must be between 1 and 50');
    const request: BrowserFetchRequest = {
      url: 'https://www.uisdc.com/news',
      headers: { accept: 'text/html' },
      responseType: 'text',
      withCookies: false,
    };
    const response = await context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new Error(`uisdc news failed: HTTP ${response.status}`);
    const html = String(response.body);
    const chunks = [
      ...html.matchAll(
        /<[^>]+class=["'][^"']*dubao-item[^"']*["'][^>]*>([\s\S]*?)(?=<[^>]+class=["'][^"']*dubao-item|<\/section>|<\/article>)/gi,
      ),
    ];
    const rows = chunks
      .slice(0, limit)
      .map((match, index) => {
        const chunk = match[1] ?? '';
        const href = chunk.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1] ?? '';
        return {
          rank: index + 1,
          title: clean(
            chunk.match(/<[^>]+class=["'][^"']*dubao-title[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] ??
              '',
          ),
          summary: clean(
            chunk.match(/<[^>]+class=["'][^"']*dubao-content[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] ??
              '',
          ),
          url: href ? new URL(href, 'https://www.uisdc.com/news').toString() : '',
        };
      })
      .filter(row => row.title && row.url);
    if (!rows.length) throw new SiteError('shape-drift', 'UISDC news selectors returned no rows');
    return rows;
  },
});
