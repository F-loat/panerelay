import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BBC_FEED_BASE = 'https://feeds.bbci.co.uk/news';
export const TOPICS = [
  'world',
  'business',
  'politics',
  'health',
  'education',
  'science_and_environment',
  'technology',
  'entertainment_and_arts',
];

export function bounded(value: unknown, fallback = 20): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 50)
    throw new Error('bbc limit must be an integer between 1 and 50');
  return result;
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function decode(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(
      /&(amp|lt|gt|quot|apos|#39|nbsp);/g,
      entity =>
        ({
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&apos;': "'",
          '&#39;': "'",
          '&nbsp;': ' ',
        })[entity] ?? entity,
    );
}

export function tag(block: string, name: string): string {
  const cdata = block.match(
    new RegExp(`<${name}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${name}>`),
  );
  const plain = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
  return decode(cdata?.[1] ?? plain?.[1] ?? '').trim();
}

export function parse(
  xml: string,
): Array<{ title: string; description: string; link: string; pubDate: string }> {
  const result: Array<{ title: string; description: string; link: string; pubDate: string }> = [];
  for (const match of xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)) {
    const block = match[1] ?? '';
    result.push({
      title: tag(block, 'title'),
      description: tag(block, 'description'),
      link: tag(block, 'link'),
      pubDate: tag(block, 'pubDate'),
    });
  }
  return result;
}

export class BbcClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async rss(path: string): Promise<string> {
    const request: BrowserFetchRequest = {
      url: `${BBC_FEED_BASE}/${path}`,
      responseType: 'text',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new Error(`bbc request failed: HTTP ${response.status}`);
    return String(response.body ?? '');
  }
}
