import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://dblp.org';
export type Row = Record<string, unknown>;
export function text(value: unknown): string {
  return String(value ?? '');
}
export function required(value: unknown, label: string): string {
  const result = text(value).trim();
  if (!result) throw new Error(`dblp ${label} cannot be empty`);
  return result;
}
export function limit(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`dblp limit must be an integer between 1 and ${maximum}`);
  return result;
}
export function recordKey(value: unknown): string {
  const result = required(value, 'paper key');
  if (!/^[a-z]+(?:\/[A-Za-z0-9_.-]+)+$/.test(result))
    throw new Error(`dblp paper key "${value}" is not valid`);
  return result;
}
export function pick(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const key of path.split('.'))
    current = current && typeof current === 'object' ? (current as Row)[key] : undefined;
  return current;
}
export function decode(value: unknown): string {
  return text(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}
export function first(xml: string, tag: string): string {
  return xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? '';
}
export function all(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g'))].map(
    match => match[1] ?? '',
  );
}
export function xmlRow(xml: string): Row {
  const key =
    xml.match(
      /<(?:article|inproceedings|incollection|proceedings|book|phdthesis|mastersthesis)\b[^>]*\bkey="([^"]+)"/,
    )?.[1] ?? '';
  const type =
    xml.match(
      /<(article|inproceedings|incollection|proceedings|book|phdthesis|mastersthesis)\b/,
    )?.[1] ?? '';
  const authors = all(xml, 'author')
    .map(value =>
      decode(value)
        .replace(/\s+\d{4,}$/, '')
        .trim(),
    )
    .filter(Boolean)
    .join(', ');
  const doi = (xml.match(/<ee\b[^>]*>([^<]*?(?:doi\.org\/|10\.[^"<]+))<\/ee>/i)?.[1] ?? '').replace(
    /^https?:\/\/(?:dx\.)?doi\.org\//i,
    '',
  );
  return {
    key,
    type: type === 'inproceedings' ? 'conf' : type === 'article' ? 'journal' : type,
    title: decode(first(xml, 'title')).replace(/\.\s*$/, ''),
    authors,
    venue: decode(first(xml, type === 'inproceedings' ? 'booktitle' : 'journal')),
    year: decode(first(xml, 'year')),
    pages: decode(first(xml, 'pages')),
    doi: doi.startsWith('10.') ? doi : '',
    openAccessUrl: (
      xml.match(/<ee\b[^>]*type=["']oa["'][^>]*>([\s\S]*?)<\/ee>/)?.[1] ??
      xml.match(/<ee\b[^>]*>([\s\S]*?)<\/ee>/)?.[1] ??
      ''
    ).trim(),
    dblpUrl: key ? `${BASE}/rec/${key}.html` : '',
  };
}

export class DblpClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(path: string, responseType: 'json' | 'text'): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      responseType,
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`dblp resource not found: ${path}`);
    if (response.status === 429) throw new Error('dblp returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== responseType)
      throw new Error(`dblp request failed: HTTP ${response.status}`);
    return response.body;
  }
  async json(path: string): Promise<Row> {
    return (await this.request(path, 'json')) as Row;
  }
  async xml(path: string): Promise<string> {
    return String(await this.request(path, 'text'));
  }
}
