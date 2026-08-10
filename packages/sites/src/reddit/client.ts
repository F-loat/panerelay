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

export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`reddit ${name} is required`);
  return result;
}

export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`reddit value must be an integer between 1 and ${maximum}`);
  return result;
}

export function decodeHtml(value: unknown): string {
  return text(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/gi, "'");
}

export function username(value: unknown): string {
  return required(value, 'username').replace(/^u\//i, '');
}

export function subredditName(value: unknown, strict = false): string {
  const result = required(value, 'subreddit').replace(/^\/?r\//i, '');
  const pattern = strict ? /^[A-Za-z][A-Za-z0-9_]{2,20}$/ : /^[A-Za-z0-9_]+$/;
  if (!pattern.test(result)) throw new Error(`reddit subreddit is invalid: ${result}`);
  return result;
}

export function postId(value: unknown): string {
  const raw = required(value, 'post-id');
  const fullname = raw.match(/^t3_([a-z0-9]+)$/i);
  if (fullname?.[1]) return fullname[1].toLowerCase();
  if (/^https?:\/\//i.test(raw)) {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || !/(^|\.)reddit\.com$/i.test(parsed.hostname))
      throw new Error('reddit post URL must use https reddit.com');
    const match = parsed.pathname.match(/\/comments\/([a-z0-9]+)/i);
    if (match?.[1]) return match[1].toLowerCase();
    throw new Error('reddit post URL contains no post ID');
  }
  if (!/^[a-z0-9]+$/i.test(raw)) throw new Error(`reddit post ID is invalid: ${raw}`);
  return raw.toLowerCase();
}

export function postFullname(value: unknown): string {
  const raw = required(value, 'post-id');
  if (/^t[13]_[a-z0-9]+$/i.test(raw)) return raw.toLowerCase();
  return `t3_${postId(raw)}`;
}

export function commentFullname(value: unknown): string {
  const raw = required(value, 'comment-id');
  const fullname = raw.match(/^t1_([a-z0-9]+)$/i);
  if (fullname?.[1]) return `t1_${fullname[1].toLowerCase()}`;
  if (/^https?:\/\//i.test(raw)) {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || !/(^|\.)reddit\.com$/i.test(parsed.hostname))
      throw new Error('reddit comment URL must use https reddit.com');
    const parts = parsed.pathname.split('/').filter(Boolean);
    const comments = parts.indexOf('comments');
    const id = comments >= 0 ? parts[comments + 3] : undefined;
    if (id && /^[a-z0-9]+$/i.test(id)) return `t1_${id.toLowerCase()}`;
    throw new Error('reddit comment URL contains no comment ID');
  }
  if (!/^[a-z0-9]+$/i.test(raw)) throw new Error(`reddit comment ID is invalid: ${raw}`);
  return `t1_${raw.toLowerCase()}`;
}

export class RedditClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async get(path: string): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: new URL(path, 'https://www.reddit.com').href,
      headers: { accept: 'application/json', referer: 'https://www.reddit.com/' },
      responseType: 'json',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 401 || response.status === 403)
      throw new Error('reddit requires a valid logged-in browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`reddit request failed: HTTP ${response.status}`);
    return response.body;
  }

  async post(path: string, fields: Record<string, string>, json = false): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: new URL(path, 'https://www.reddit.com').href,
      method: 'POST',
      headers: {
        accept: json ? 'application/json' : '*/*',
        'content-type': 'application/x-www-form-urlencoded',
        referer: 'https://www.reddit.com/',
      },
      body: { encoding: 'utf8', data: new URLSearchParams(fields).toString() },
      responseType: json ? 'json' : 'text',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 401 || response.status === 403)
      throw new Error('reddit requires a valid logged-in browser session');
    if (response.status < 200 || response.status >= 300)
      throw new Error(`reddit request failed: HTTP ${response.status}`);
    if (json && response.bodyType !== 'json') throw new Error('reddit response is not JSON');
    return response.body;
  }

  async me(): Promise<Value> {
    const identity = object(pick(await this.get('/api/me.json?raw_json=1'), 'data'));
    if (!text(pick(identity, 'name')))
      throw new Error('reddit requires a valid logged-in browser session');
    return identity;
  }

  async modhash(): Promise<string> {
    return text(pick(await this.me(), 'modhash'));
  }
}

export function listing(payload: unknown): Value[] {
  const children = pick(pick(payload, 'data'), 'children');
  if (!Array.isArray(children)) throw new Error('reddit listing response is malformed');
  return children.map(item => object(pick(item, 'data')));
}

export function media(post: Value) {
  const gallery: string[] = [];
  const items = pick(pick(post, 'gallery_data'), 'items');
  const metadata = object(pick(post, 'media_metadata'));
  if (Array.isArray(items)) {
    for (const item of items) {
      const selected = object(pick(metadata, text(pick(item, 'media_id'))));
      const source = object(pick(selected, 's'));
      const url = decodeHtml(pick(source, 'u') ?? pick(source, 'gif') ?? pick(source, 'mp4'));
      if (url) gallery.push(url);
    }
  }
  const images = pick(pick(post, 'preview'), 'images');
  const first = Array.isArray(images) ? object(images[0]) : {};
  return {
    post_hint: text(pick(post, 'post_hint')),
    url_overridden_by_dest: decodeHtml(pick(post, 'url_overridden_by_dest')),
    preview_image_url: decodeHtml(pick(pick(first, 'source'), 'url')),
    gallery_urls: gallery,
  };
}

export function postRow(post: Value, rank?: number) {
  return {
    ...(rank === undefined ? {} : { rank }),
    id: text(pick(post, 'id')),
    postId: text(pick(post, 'id')),
    title: text(pick(post, 'title')),
    subreddit: text(pick(post, 'subreddit_name_prefixed')),
    author: text(pick(post, 'author')),
    score: pick(post, 'score') ?? 0,
    upvotes: pick(post, 'score') ?? 0,
    comments: pick(post, 'num_comments') ?? 0,
    url: pick(post, 'permalink') ? `https://www.reddit.com${text(pick(post, 'permalink'))}` : '',
    created_utc: pick(post, 'created_utc') ?? null,
    selftext: text(pick(post, 'selftext')),
    ...media(post),
  };
}

export function writeErrors(payload: unknown): string {
  const errors = pick(pick(payload, 'json'), 'errors');
  if (!Array.isArray(errors)) return '';
  return errors
    .map(error => (Array.isArray(error) ? error.map(text).join(': ') : text(error)))
    .filter(Boolean)
    .join('; ');
}
