import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
export type JsonObject = Record<string, unknown>;
export function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`instagram ${name} is required`);
  return result;
}
export function bounded(value: unknown, fallback: number, maximum: number): number {
  const parsed = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum)
    throw new Error(`instagram value must be between 1 and ${maximum}`);
  return parsed;
}
export function flag(value: unknown): boolean {
  return value === true || text(value).toLowerCase() === 'true';
}
export function confirm(args: JsonObject): void {
  if (!flag(args.execute)) throw new Error('instagram write requires --execute');
}
const APP_ID = '936619743392459';

export class InstagramClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(path: string, init: Partial<BrowserFetchRequest> = {}): Promise<JsonObject> {
    const response = await this.#context.fetch({
      url: new URL(path, 'https://www.instagram.com').toString(),
      method: init.method ?? 'GET',
      headers: {
        accept: 'application/json',
        'x-ig-app-id': APP_ID,
        referer: 'https://www.instagram.com/',
        ...init.headers,
      },
      ...(init.body ? { body: init.body } : {}),
      ...(init.bindings ? { bindings: init.bindings } : {}),
      responseType: 'json',
      withCookies: true,
    });
    if (response.status === 401 || response.status === 403)
      throw new Error('instagram requires a valid logged-in browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`instagram request failed: HTTP ${response.status}`);
    const data = object(response.body);
    if (text(data.status) && text(data.status) !== 'ok')
      throw new Error(text(data.message) || `instagram API returned ${data.status}`);
    return data;
  }
  async post(path: string, fields?: Record<string, string>): Promise<JsonObject> {
    return this.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: { encoding: 'utf8', data: fields ? new URLSearchParams(fields).toString() : '' },
      bindings: ['instagram-csrf'],
    });
  }
  async profile(username: string): Promise<JsonObject> {
    const data = await this.request(
      `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    );
    const user = object(object(data.data).user);
    if (!text(user.id)) throw new Error(`instagram user not found: ${username}`);
    return user;
  }
  async media(username: string, index: number): Promise<JsonObject> {
    const profile = await this.profile(username);
    const data = await this.request(
      `/api/v1/feed/user/${encodeURIComponent(text(profile.id))}/?count=${index}`,
    );
    const items = Array.isArray(data.items) ? data.items.map(object) : [];
    const media = items[index - 1];
    if (!media) throw new Error(`instagram post index ${index} not found`);
    return media;
  }
}

export function userRow(raw: unknown, rank: number) {
  const user = object(raw);
  return {
    rank,
    username: text(user.username),
    name: text(user.full_name),
    verified: user.is_verified ? 'Yes' : 'No',
    private: user.is_private ? 'Yes' : 'No',
    url: `https://www.instagram.com/${text(user.username)}`,
  };
}
export function mediaRow(raw: unknown, index: number) {
  const media = object(raw);
  return {
    index,
    user: text(object(media.user).username),
    caption: text(object(media.caption).text).replace(/\n/g, ' ').slice(0, 100),
    likes: Number(media.like_count ?? media.play_count ?? 0),
    comments: Number(media.comment_count ?? 0),
    type:
      Number(media.media_type) === 1
        ? 'photo'
        : Number(media.media_type) === 2
          ? 'video'
          : 'carousel',
    code: text(media.code),
    url: text(media.code) ? `https://www.instagram.com/p/${text(media.code)}/` : '',
  };
}
