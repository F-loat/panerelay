import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
export const FEEDS = {
  main: 'https://feeds.bloomberg.com/news.rss',
  markets: 'https://feeds.bloomberg.com/markets/news.rss',
  economics: 'https://feeds.bloomberg.com/economics/news.rss',
  industries: 'https://feeds.bloomberg.com/industries/news.rss',
  tech: 'https://feeds.bloomberg.com/technology/news.rss',
  politics: 'https://feeds.bloomberg.com/politics/news.rss',
  opinions: 'https://feeds.bloomberg.com/bview/news.rss',
  green: 'https://feeds.bloomberg.com/green/news.rss',
  crypto: 'https://feeds.bloomberg.com/crypto/news.rss',
  pursuits: 'https://feeds.bloomberg.com/pursuits/news.rss',
};
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function decode(value: unknown): string {
  return text(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
function field(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match?.[1] || '';
}
export class BloombergClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async feed(name: string, limit: number): Promise<Record<string, unknown>[]> {
    const url = FEEDS[name as keyof typeof FEEDS];
    if (!url) throw new Error(`bloomberg feed must be one of: ${Object.keys(FEEDS).join(', ')}`);
    const request: BrowserFetchRequest = {
      url,
      headers: { accept: 'application/rss+xml, application/xml' },
      responseType: 'text',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new Error(`bloomberg ${name} feed failed: HTTP ${response.status}`);
    const rows: Record<string, unknown>[] = [];
    const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text(response.body))) !== null && rows.length < limit) {
      const block = match[1] || '';
      rows.push({
        rank: rows.length + 1,
        title: decode(field(block, 'title')),
        summary: decode(field(block, 'description'))
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
        link: decode(field(block, 'link')),
        published: decode(field(block, 'pubDate')),
      });
    }
    if (!rows.length) throw new Error(`bloomberg ${name} feed returned no items`);
    return rows;
  }
}
