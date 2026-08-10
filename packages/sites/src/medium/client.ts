import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function decode(value: unknown): string {
  return text(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(
      /&(amp|lt|gt|quot|apos|#39|nbsp);/g,
      match =>
        ({
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&apos;': "'",
          '&#39;': "'",
          '&nbsp;': ' ',
        })[match] || match,
    );
}
export function strip(value: unknown): string {
  return decode(
    text(value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  );
}
export function tag(value: unknown): string {
  const result = text(value).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(result))
    throw new Error('medium tag must contain only letters, digits, or hyphens');
  return result;
}
function field(block: string, name: string): string {
  const cdata = block.match(
    new RegExp(`<${name}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${name}>`, 'i'),
  );
  if (cdata?.[1]) return cdata[1];
  const plain = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return plain?.[1] || '';
}
export async function feed(
  context: SiteCommandContext,
  name: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const request: BrowserFetchRequest = {
    url: `https://medium.com/feed/tag/${encodeURIComponent(tag(name))}`,
    headers: { accept: 'application/rss+xml, application/xml' },
    responseType: 'text',
    withCookies: false,
  };
  const response = await context.fetch(request);
  if (response.status === 404) throw new Error(`medium tag ${name} was not found`);
  if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
    throw new Error(`medium tag request failed: HTTP ${response.status}`);
  const xml = text(response.body);
  const rows: Record<string, unknown>[] = [];
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null && rows.length < limit) {
    const block = match[1] || '';
    const published = new Date(decode(field(block, 'pubDate')));
    rows.push({
      rank: rows.length + 1,
      title: decode(field(block, 'title')),
      author: decode(field(block, 'dc:creator')),
      description: strip(field(block, 'description')),
      published: Number.isNaN(published.getTime()) ? '' : published.toISOString().slice(0, 10),
      url: decode(field(block, 'link')),
    });
  }
  if (!rows.length) throw new Error(`medium tag ${name} returned no articles`);
  return rows;
}
