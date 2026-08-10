import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`v2ex ${label} cannot be empty`);
  return result;
}

export function limit(value: unknown, fallback = 20, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum) {
    throw new Error(`v2ex limit must be an integer between 1 and ${maximum}`);
  }
  return result;
}

export class V2exClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async get(path: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const url = new URL(`https://www.v2ex.com/api/${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    }
    const request: BrowserFetchRequest = {
      url: url.toString(),
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json') {
      throw new Error(`v2ex request failed: HTTP ${response.status}`);
    }
    return response.body;
  }
  async html(path: string): Promise<string> {
    const url = new URL(path, 'https://www.v2ex.com');
    const response = await this.#context.fetch({
      url: url.toString(),
      headers: { accept: 'text/html,application/xhtml+xml' },
      responseType: 'text',
      withCookies: true,
    });
    if (response.status === 401 || response.status === 403)
      throw new Error('v2ex requires a valid logged-in browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new Error(`v2ex ${url.pathname} failed: HTTP ${response.status}`);
    return String(response.body);
  }
}

export function htmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function accountFromHtml(html: string) {
  const member = html.match(/<a[^>]+href=["']\/member\/([A-Za-z0-9_-]+)["'][^>]*>([\s\S]*?)<\/a>/i);
  const username = member?.[1] || htmlText(member?.[2]);
  if (!username) throw new Error('v2ex requires a valid logged-in browser session');
  const balance = html.match(/<a[^>]+class=["'][^"']*balance_area[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const notifications = html.match(/<a[^>]+href=["']\/notifications["'][^>]*>([\s\S]*?)<\/a>/i);
  return {
    username,
    balance: htmlText(balance?.[1]) || '0',
    unread_notifications: htmlText(notifications?.[1]).match(/(\d+)\s*未读提醒/)?.[1] || '0',
    daily_reward_ready: /href=["']\/mission\/daily[^"']*["'][^>]*>[\s\S]*?领取今日的登录奖励/i.test(
      html,
    )
      ? '是'
      : '否',
  };
}

export function rows(value: unknown, label: string): Value[] {
  if (!Array.isArray(value) || !value.length) throw new Error(`${label} returned no rows`);
  return value.filter(item => item && typeof item === 'object') as Value[];
}

export function topicRow(item: Value, rank: number): Value {
  return {
    id: pick(item, 'id') ?? '',
    rank,
    title: text(pick(item, 'title')),
    author: text(pick(pick(item, 'member'), 'username')),
    node: text(pick(pick(item, 'node'), 'title')),
    replies: pick(item, 'replies') ?? 0,
    url: text(pick(item, 'url')),
  };
}
