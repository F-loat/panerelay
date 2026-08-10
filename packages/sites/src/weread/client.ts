import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export type Value = Record<string, unknown>;
const ORIGIN = 'https://weread.qq.com';
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function object(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Value) : {};
}
export function text(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`weread ${name} cannot be empty`);
  return result;
}
export function positive(value: unknown, fallback: number, maximum: number, name: string): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`weread ${name} must be an integer between 1 and ${maximum}`);
  return result;
}
export function readerUrl(path: string): string {
  return new URL(path, ORIGIN).toString();
}

function decode(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, raw: string) =>
      String.fromCodePoint(Number.parseInt(raw, 16)),
    )
    .replace(/&#(\d+);/g, (_, raw: string) => String.fromCodePoint(Number(raw)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchEntry {
  title: string;
  author: string;
  url: string;
}

export class WereadClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(
    path: string,
    responseType: 'json' | 'text',
    params?: Record<string, string>,
  ): Promise<unknown> {
    const url = new URL(path, ORIGIN);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    const request: BrowserFetchRequest = {
      url: url.toString(),
      method: 'GET',
      headers: { accept: responseType === 'json' ? 'application/json' : 'text/html' },
      responseType,
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== responseType)
      throw new Error(`weread ${path} failed: HTTP ${response.status}`);
    return response.body;
  }
  async json(path: string, params?: Record<string, string>): Promise<Value> {
    return object(await this.request(path, 'json', params));
  }
  async html(path: string, params?: Record<string, string>): Promise<string> {
    return String((await this.request(path, 'text', params)) ?? '');
  }
  async privateJson(path: string, params?: Record<string, string>): Promise<Value> {
    const url = new URL(path, 'https://i.weread.qq.com');
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    const response = await this.#context.fetch({
      url: url.toString(),
      headers: {
        accept: 'application/json',
        origin: ORIGIN,
        referer: `${ORIGIN}/`,
      },
      responseType: 'json',
      withCookies: true,
    });
    if (response.status === 401 || response.status === 403)
      throw new Error('weread requires a valid logged-in browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`weread ${path} failed: HTTP ${response.status}`);
    const data = object(response.body);
    if ([-2010, -2012].includes(Number(pick(data, 'errcode'))))
      throw new Error('weread requires a valid logged-in browser session');
    if (pick(data, 'errcode') != null && Number(pick(data, 'errcode')) !== 0)
      throw new Error(
        text(pick(data, 'errmsg')) || `weread API error ${text(pick(data, 'errcode'))}`,
      );
    return data;
  }
  async postJson(path: string, body: unknown, withCookies: boolean): Promise<Value> {
    const response = await this.#context.fetch({
      url: new URL(path, `${ORIGIN}/web/`).toString(),
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        origin: ORIGIN,
        referer: `${ORIGIN}/`,
      },
      body: { encoding: 'utf8', data: JSON.stringify(body) },
      responseType: 'json',
      withCookies,
    });
    if (response.status === 401 || response.status === 403)
      throw new Error('weread requires a valid logged-in browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`weread ${path} failed: HTTP ${response.status}`);
    const data = object(response.body);
    if ([-2010, -2012].includes(Number(pick(data, 'errcode'))))
      throw new Error('weread requires a valid logged-in browser session');
    return data;
  }
  async searchBooks(query: string): Promise<Value[]> {
    const books = pick(await this.json('/web/search/global', { keyword: query }), 'books');
    if (!Array.isArray(books))
      throw new Error('weread search returned an unexpected books payload');
    return books.filter(item => item && typeof item === 'object') as Value[];
  }
  async searchEntries(query: string): Promise<SearchEntry[]> {
    const html = await this.html('/web/search/books', { keyword: query });
    const entries = [];
    for (const match of html.matchAll(
      /<li[^>]*class=["']wr_bookList_item["'][^>]*>([\s\S]*?)<\/li>/g,
    )) {
      const chunk = match[1] ?? '';
      const href =
        chunk.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["']wr_bookList_item_link["']/)?.[1] ??
        chunk.match(/<a[^>]*class=["']wr_bookList_item_link["'][^>]*href=["']([^"']+)["']/)?.[1] ??
        '';
      const title = decode(
        chunk.match(/<p[^>]*class=["']wr_bookList_item_title["'][^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '',
      );
      const author = decode(
        chunk.match(/<p[^>]*class=["']wr_bookList_item_author["'][^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '',
      );
      if (href && title) entries.push({ title, author, url: readerUrl(href) });
    }
    return entries;
  }
}

export function info(item: unknown): Value {
  return object(pick(item, 'bookInfo'));
}
export function resolveUrl(title: string, author: string, entries: SearchEntry[]): string | null {
  const exact = entries.filter(entry => entry.title === title && entry.author === author);
  if (exact.length === 1) return exact[0]?.url ?? null;
  const sameTitle = entries.filter(entry => entry.title === title);
  return sameTitle.length === 1 ? (sameTitle[0]?.url ?? null) : null;
}
