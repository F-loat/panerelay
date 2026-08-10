import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export function text(value: unknown): string {
  return String(value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

export function limit(value: unknown, fallback = 10): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 100) {
    throw new Error('google limit must be an integer between 1 and 100');
  }
  return result;
}

function field(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return text(match?.[1]);
}

export async function rss(
  context: SiteCommandContext,
  url: string,
  take: number,
): Promise<Record<string, unknown>[]> {
  const request: BrowserFetchRequest = {
    url,
    headers: { accept: 'application/rss+xml, application/xml' },
    responseType: 'text',
    withCookies: false,
  };
  const response = await context.fetch(request);
  if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text') {
    throw new Error(`google RSS request failed: HTTP ${response.status}`);
  }
  const rows: Record<string, unknown>[] = [];
  const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemPattern.exec(String(response.body ?? ''))) !== null && rows.length < take) {
    const block = match[1] ?? '';
    rows.push({
      title: field(block, 'title'),
      source: field(block, 'source'),
      date: field(block, 'pubDate'),
      traffic: field(block, 'ht:approx_traffic'),
      url: field(block, 'link'),
    });
  }
  if (!rows.length) throw new Error('google RSS returned no items');
  return rows;
}
