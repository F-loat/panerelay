import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const API_ORIGIN = 'https://export.arxiv.org/api/query';
export type AdapterArgs = Record<string, string | number | boolean>;
export type Paper = {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  published: string;
  updated: string;
  primary_category: string;
  categories: string;
  comment: string;
  pdf: string;
  url: string;
};

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'");
}

function first(xml: string, tag: string): string {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? '';
}

function all(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(match =>
    (match[1] ?? '').trim(),
  );
}

function attribute(xml: string, tag: string, name: string): string {
  return xml.match(new RegExp(`<${tag}\\b[^>]*?\\b${name}="([^"]*)"`))?.[1] ?? '';
}

function link(xml: string, rel: string): string {
  for (const match of xml.matchAll(/<link\b([^>]*)\/?\s*>/g)) {
    const attributes = match[1] ?? '';
    if (new RegExp(`\\brel="${rel}"`).test(attributes))
      return attributes.match(/\bhref="([^"]*)"/)?.[1] ?? '';
  }
  return '';
}

export function parseEntries(xml: string): Paper[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(match => {
    const entry = match[1] ?? '';
    const rawId = first(entry, 'id');
    const id = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '');
    return {
      id,
      title: decode(first(entry, 'title').replace(/\s+/g, ' ')),
      authors: decode(all(entry, 'name').join(', ')),
      abstract: decode(first(entry, 'summary').replace(/\s+/g, ' ')),
      published: first(entry, 'published').slice(0, 10),
      updated: first(entry, 'updated').slice(0, 10),
      primary_category: attribute(entry, 'arxiv:primary_category', 'term'),
      categories: [...entry.matchAll(/<category\b[^>]*\bterm="([^"]*)"/g)]
        .map(match => match[1] ?? '')
        .join(', '),
      comment: decode(first(entry, 'arxiv:comment').replace(/\s+/g, ' ')),
      pdf: link(entry, 'related') || `https://arxiv.org/pdf/${id}`,
      url: `https://arxiv.org/abs/${id}`,
    };
  });
}

export function positiveInteger(
  value: unknown,
  label: string,
  fallback: number,
  maximum: number,
): number {
  const selected = value == null || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > maximum)
    throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  return selected;
}

export function requiredString(args: AdapterArgs, name: string): string {
  const value = String(args[name] ?? '').trim();
  if (!value) throw new Error(`arXiv ${name} is required`);
  return value;
}

export class ArxivClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async query(params: Record<string, string | number>): Promise<Paper[]> {
    const request: BrowserFetchRequest = {
      url: API_ORIGIN,
      query: Object.entries(params).map(([name, value]) => ({ name, value: String(value) })),
      responseType: 'text',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300)
      throw new Error(`arXiv API returned HTTP ${response.status}`);
    if (response.bodyType !== 'text') throw new Error('arXiv API response is not XML text');
    return parseEntries(String(response.body));
  }
}

export function listing(papers: Paper[]) {
  return papers.map(({ id, title, authors, published, primary_category, url }) => ({
    id,
    title,
    authors,
    published,
    primary_category,
    url,
  }));
}
