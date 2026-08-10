import type {
  BrowserFetchRequest,
  BrowserFetchResponse,
  SiteCommandContext,
} from '@panerelay/site-kit';
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
export function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`weibo ${name} is required`);
  return result;
}
export function bounded(value: unknown, fallback: number, maximum: number): number {
  const result = value == null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`weibo limit must be between 1 and ${maximum}`);
  return result;
}
export class WeiboClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async probe(path: string): Promise<BrowserFetchResponse> {
    return this.#context.fetch({
      url: new URL(path, 'https://weibo.com').toString(),
      headers: { accept: 'application/json', referer: 'https://weibo.com/' },
      responseType: 'json',
      withCookies: true,
    });
  }

  async get(path: string): Promise<Value> {
    const response = await this.probe(path);
    if (response.status === 401 || response.status === 403)
      throw new Error('weibo requires a valid logged-in browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`weibo request failed: HTTP ${response.status}`);
    const data = object(response.body);
    if (pick(data, 'ok') === 0)
      throw new Error(
        text(pick(data, 'msg') ?? pick(data, 'message')) || 'weibo API returned ok=0',
      );
    return data;
  }
  async post(path: string, fields: Record<string, string>): Promise<Value> {
    const request: BrowserFetchRequest = {
      url: new URL(path, 'https://weibo.com').toString(),
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://weibo.com',
        referer: 'https://weibo.com/',
      },
      body: { encoding: 'utf8', data: new URLSearchParams(fields).toString() },
      bindings: ['weibo-xsrf'],
      responseType: 'json',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 401 || response.status === 403)
      throw new Error('weibo requires a valid logged-in browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`weibo write failed: HTTP ${response.status}`);
    const data = object(response.body);
    if (pick(data, 'ok') !== 1)
      throw new Error(
        text(pick(data, 'msg') ?? pick(data, 'message')) || 'weibo write returned non-ok',
      );
    return data;
  }
  async html(path: string): Promise<string> {
    const response = await this.#context.fetch({
      url: new URL(path, 'https://s.weibo.com').toString(),
      headers: { accept: 'text/html' },
      responseType: 'text',
      withCookies: true,
    });
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new Error(`weibo search failed: HTTP ${response.status}`);
    return String(response.body);
  }
  async selfUid(): Promise<string> {
    const uid = text(pick(pick(await this.get('/ajax/config/get_config'), 'data'), 'uid'));
    if (!uid) throw new Error('weibo session returned no current uid');
    return uid;
  }
}
export function postRow(post: Value, rank?: number) {
  const user = object(pick(post, 'user'));
  const mblogid = text(pick(post, 'mblogid'));
  return {
    ...(rank == null ? {} : { rank }),
    id: text(pick(post, 'idstr') ?? pick(post, 'id')),
    mblogid,
    author: text(pick(user, 'screen_name')),
    uid: text(pick(user, 'id')),
    text: text(pick(post, 'text_raw')) || clean(pick(post, 'text')),
    time: text(pick(post, 'created_at')),
    reposts: pick(post, 'reposts_count') ?? 0,
    comments: pick(post, 'comments_count') ?? 0,
    likes: pick(post, 'attitudes_count') ?? 0,
    pic_count: pick(post, 'pic_num') ?? Object.keys(object(pick(post, 'pic_infos'))).length,
    url: `https://weibo.com/${text(pick(user, 'id'))}/${mblogid}`,
  };
}
export function profileRow(user: Value, detail: Value = {}) {
  return {
    screen_name: text(pick(user, 'screen_name')),
    uid: text(pick(user, 'id')),
    followers: pick(user, 'followers_count') ?? 0,
    following: pick(user, 'friends_count') ?? 0,
    statuses: pick(user, 'statuses_count') ?? 0,
    verified: pick(user, 'verified') ?? false,
    description: text(pick(user, 'description') ?? pick(detail, 'description')),
    location: text(pick(user, 'location')),
    url: `https://weibo.com${text(pick(user, 'profile_url')) || `/u/${text(pick(user, 'id'))}`}`,
  };
}
