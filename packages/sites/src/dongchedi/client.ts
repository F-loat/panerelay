import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export type Value = Record<string, unknown>;

const BASE_URL = 'https://www.dongchedi.com';
const FALLBACK_KEYS = new Set([
  '__hasUrlCity',
  'is_gray',
  'has_gray',
  'clientIp',
  'sensitiveSeriesIdList',
]);

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

export function requiredText(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`dongchedi ${label} must be a non-empty string`);
  return result;
}

export function numericId(value: unknown, label: string): string {
  const result = text(value);
  if (!/^\d+$/.test(result) || result === '0') {
    throw new Error(`dongchedi ${label} did not include a stable numeric id`);
  }
  return result;
}

export function seriesId(value: unknown): string {
  const input = requiredText(value, 'series_id');
  const match = input.match(/series\/(\d+)/) ?? input.match(/^(\d+)$/);
  if (!match?.[1]) throw new Error(`dongchedi series_id "${input}" is invalid`);
  return match[1];
}

export function limit(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum) {
    throw new Error(`dongchedi limit must be an integer between 1 and ${maximum}`);
  }
  return result;
}

export function score(value: unknown): number | null {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? Number((result / 100).toFixed(2)) : null;
}

export function pageUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export class DongchediClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async pageProps(path: string): Promise<Value> {
    const request: BrowserFetchRequest = {
      url: pageUrl(path),
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'zh-CN,zh;q=0.9',
      },
      responseType: 'text',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text') {
      throw new Error(`dongchedi request failed: HTTP ${response.status}`);
    }
    const match = String(response.body ?? '').match(
      /<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!match?.[1]) throw new Error('dongchedi response contained no __NEXT_DATA__');
    let payload: unknown;
    try {
      payload = JSON.parse(match[1]);
    } catch {
      throw new Error('dongchedi returned invalid __NEXT_DATA__ JSON');
    }
    const props = object(pick(object(pick(payload, 'props')), 'pageProps'));
    const realKeys = Object.keys(props).filter(key => !FALLBACK_KEYS.has(key));
    if (!realKeys.length) throw new Error('dongchedi returned its empty fallback page');
    return props;
  }
}
