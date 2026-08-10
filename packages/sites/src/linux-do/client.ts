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
  if (!result) throw new Error(`linux-do ${name} cannot be empty`);
  return result;
}

export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`linux-do value must be an integer between 1 and ${maximum}`);
  return result;
}

export function localTime(value: unknown): string {
  const source = text(value);
  if (!source) return '';
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? source : date.toLocaleString();
}

export function stripHtml(value: unknown): string {
  return text(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:(\d+)|x([\da-f]+));/gi, (_match, decimal, hex) => {
      try {
        return String.fromCodePoint(
          decimal === undefined ? Number.parseInt(hex, 16) : Number(decimal),
        );
      } catch {
        return '';
      }
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export class LinuxDoClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async get(path: string): Promise<Value> {
    const request: BrowserFetchRequest = {
      url: new URL(path, 'https://linux.do').href,
      headers: { accept: 'application/json', referer: 'https://linux.do/' },
      responseType: 'json',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 401 || response.status === 403)
      throw new Error('linux-do requires a valid logged-in browser session');
    if (
      response.status < 200 ||
      response.status >= 300 ||
      response.bodyType !== 'json' ||
      !response.body ||
      typeof response.body !== 'object' ||
      Array.isArray(response.body)
    )
      throw new Error(`linux-do request failed: HTTP ${response.status}`);
    return response.body as Value;
  }
}

export function topics(body: Value): Value[] {
  const rows = pick(pick(body, 'topic_list'), 'topics');
  if (!Array.isArray(rows)) throw new Error('linux-do topic list response is malformed');
  return rows.map(object);
}

export function topicRow(topic: Value) {
  return {
    title: text(pick(topic, 'fancy_title')) || text(pick(topic, 'title')),
    replies: Math.max(0, Number(pick(topic, 'posts_count') ?? 1) - 1),
    created: localTime(pick(topic, 'created_at')),
    likes: pick(topic, 'like_count') ?? 0,
    views: pick(topic, 'views') ?? 0,
    url: `https://linux.do/t/topic/${text(pick(topic, 'id'))}`,
  };
}
