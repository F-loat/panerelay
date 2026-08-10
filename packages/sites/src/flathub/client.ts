import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const API_BASE = 'https://flathub.org/api/v2';
export const APP_BASE = 'https://flathub.org/apps';
type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`flathub ${label} cannot be empty`);
  return result;
}
export function boundedLimit(value: unknown, fallback = 25): number {
  const result = value == null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 100)
    throw new Error('flathub limit must be an integer between 1 and 100');
  return result;
}
export function appId(value: unknown): string {
  const result = required(value, 'appId');
  if (!/^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_][A-Za-z0-9_-]*){1,}$/.test(result))
    throw new Error(`flathub appId "${value}" is not valid`);
  return result;
}
export function joinList(value: unknown, max = 10): string {
  if (!Array.isArray(value)) return '';
  const items = value.filter(item => typeof item === 'string' && item.trim()) as string[];
  return items.length > max
    ? [...items.slice(0, max), `(+${items.length - max})`].join(', ')
    : items.join(', ');
}
export function latestRelease(value: unknown): { version: string | null; date: string | null } {
  if (!Array.isArray(value)) return { version: null, date: null };
  const rows = value
    .filter(item => item && typeof item === 'object')
    .sort((left, right) => Number(pick(right, 'timestamp')) - Number(pick(left, 'timestamp')));
  const row = rows[0];
  if (!row) return { version: null, date: null };
  const timestamp = Number(pick(row, 'timestamp'));
  return {
    version: text(pick(row, 'version')) || null,
    date:
      timestamp > 0
        ? new Date(timestamp * 1000).toISOString().slice(0, 10)
        : text(pick(row, 'date')) || null,
  };
}
export class FlathubClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(path: string, method: 'GET' | 'POST' = 'GET', body?: Value): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${API_BASE}${path}`,
      method,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? { encoding: 'utf8', data: JSON.stringify(body) } : undefined,
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`flathub resource not found: ${path}`);
    if (response.status === 429) throw new Error('flathub returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`flathub request failed: HTTP ${response.status}`);
    return response.body;
  }
}
