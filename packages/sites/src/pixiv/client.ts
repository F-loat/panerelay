import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export type Value = Record<string, unknown>;
export function object(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Value) : {};
}
export function pick(value: unknown, key: string): unknown {
  return object(value)[key];
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function numericId(value: unknown, name: string): string {
  const result = text(value);
  if (!/^\d+$/.test(result)) throw new Error(`pixiv ${name} must be a numeric ID`);
  return result;
}
export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`pixiv ${name} is required`);
  return result;
}
export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`pixiv value must be an integer between 1 and ${maximum}`);
  return result;
}

export class PixivClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async raw(path: string, params: Record<string, string | number> = {}): Promise<Value> {
    const url = new URL(path, 'https://www.pixiv.net');
    for (const [name, value] of Object.entries(params))
      url.searchParams.append(name, String(value));
    const request: BrowserFetchRequest = {
      url: url.href,
      headers: { accept: 'application/json', referer: 'https://www.pixiv.net/' },
      responseType: 'json',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 401 || response.status === 403)
      throw new Error('pixiv requires a valid logged-in browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`pixiv request failed: HTTP ${response.status}`);
    const payload = object(response.body);
    if (pick(payload, 'error') === true)
      throw new Error(
        text(pick(payload, 'message') ?? pick(payload, 'errorMessage')) || 'pixiv API failed',
      );
    return payload;
  }
  async ajax(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const payload = await this.raw(path, params);
    if (!Object.hasOwn(payload, 'body')) throw new Error('pixiv API response is malformed');
    return pick(payload, 'body');
  }
}

export function workRow(work: Value, rank: number) {
  const tags = pick(work, 'tags');
  return {
    rank,
    title: text(pick(work, 'title')),
    author: text(pick(work, 'userName')),
    user_id: text(pick(work, 'userId')),
    illust_id: text(pick(work, 'id') ?? pick(work, 'illust_id')),
    pages: pick(work, 'pageCount') ?? pick(work, 'illust_page_count') ?? 1,
    bookmarks: pick(work, 'bookmarkCount') ?? pick(work, 'illust_bookmark_count') ?? 0,
    tags: Array.isArray(tags)
      ? tags
          .slice(0, 5)
          .map(item => text(pick(item, 'tag') ?? item))
          .join(', ')
      : '',
    created: text(pick(work, 'createDate')).split('T')[0] ?? '',
    url: `https://www.pixiv.net/artworks/${text(pick(work, 'id') ?? pick(work, 'illust_id'))}`,
  };
}
