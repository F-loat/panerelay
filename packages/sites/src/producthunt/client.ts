import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
export function decode(value: unknown): string {
  return String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}
function field(block: string, name: string): string {
  return decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '');
}
export function bounded(value: unknown): number {
  const result = value == null || value === '' ? 20 : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 50)
    throw new Error('producthunt limit must be an integer between 1 and 50');
  return result;
}
export async function feed(
  context: SiteCommandContext,
  category?: string,
): Promise<Record<string, unknown>[]> {
  const url = category
    ? `https://www.producthunt.com/feed?category=${encodeURIComponent(category)}`
    : 'https://www.producthunt.com/feed';
  const request: BrowserFetchRequest = {
    url,
    headers: { accept: 'application/atom+xml, application/xml' },
    responseType: 'text',
    withCookies: false,
  };
  const response = await context.fetch(request);
  if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
    throw new Error(`producthunt feed failed: HTTP ${response.status}`);
  const rows: Record<string, unknown>[] = [];
  for (const match of String(response.body ?? '').matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)) {
    const block = match[1] ?? '';
    const name = field(block, 'title');
    if (!name) continue;
    const content = decode(field(block, 'content'))
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*Discussion\s*\|?\s*/gi, '')
      .replace(/\s*\|?\s*Link\s*$/gi, '')
      .trim();
    rows.push({
      rank: rows.length + 1,
      name,
      tagline: content.slice(0, 120),
      author: field(block, 'name'),
      date: field(block, 'published').slice(0, 10),
      url: block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '',
    });
  }
  if (!rows.length) throw new Error('producthunt feed returned no posts');
  return rows;
}
