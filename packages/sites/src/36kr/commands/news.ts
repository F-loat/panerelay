import { defineCommand } from '@panerelay/site-kit';
import type { BrowserFetchRequest } from '@panerelay/site-kit';

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function field(block: string, name: string): string {
  return decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '');
}

export default defineCommand({
  name: 'news',
  description: 'List the latest 36Kr technology and startup news.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum articles (1-50).', type: 'number', default: 20 }],
  output: ['rank', 'title', 'summary', 'date', 'url'],
  examples: ['panerelay 36kr news --limit 10'],
  async run(context, args) {
    const limit = args.limit == null || args.limit === '' ? 20 : Number(args.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error('36Kr limit must be an integer between 1 and 50');
    }
    const request: BrowserFetchRequest = {
      url: 'https://www.36kr.com/feed',
      headers: { accept: 'application/rss+xml, application/xml' },
      responseType: 'text',
      withCookies: false,
    };
    const response = await context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text') {
      throw new Error(`36Kr news failed: HTTP ${response.status}`);
    }
    const rows: Record<string, unknown>[] = [];
    for (const match of String(response.body ?? '').matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)) {
      const block = match[1] ?? '';
      const title = field(block, 'title');
      if (!title) continue;
      rows.push({
        rank: rows.length + 1,
        title,
        summary: decode(
          field(block, 'description')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' '),
        ).slice(0, 120),
        date: field(block, 'pubDate').slice(0, 16),
        url: field(block, 'link'),
      });
      if (rows.length >= limit) break;
    }
    if (!rows.length) throw new Error('36Kr news returned no articles');
    return rows;
  },
});
