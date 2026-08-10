import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://store.steampowered.com';
type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function bounded(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`steam limit must be an integer between 1 and ${maximum}`);
  return result;
}
export function country(value: unknown): string {
  const result = text(value || 'us').toLowerCase();
  if (!/^[a-z]{2}$/.test(result)) throw new Error('steam country must be a two-letter code');
  return result;
}
export function appId(value: unknown): string {
  const result = text(value);
  if (!/^\d+$/.test(result)) throw new Error('steam app id must be numeric');
  return result;
}
export function price(value: unknown): number | null {
  const result = Number(value);
  return Number.isFinite(result) ? Number((result / 100).toFixed(2)) : null;
}
export function decode(value: unknown): string {
  return text(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(
      /&(amp|lt|gt|quot|apos|#39|nbsp);/g,
      match =>
        ({
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&apos;': "'",
          '&#39;': "'",
          '&nbsp;': ' ',
        })[match] || match,
    );
}
export class SteamClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async get(url: string): Promise<Value> {
    const request: BrowserFetchRequest = {
      url,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 429) throw new Error('steam returned HTTP 429 (rate limited)');
    if (
      response.status < 200 ||
      response.status >= 300 ||
      response.bodyType !== 'json' ||
      !response.body ||
      typeof response.body !== 'object' ||
      Array.isArray(response.body)
    )
      throw new Error(`steam request failed: HTTP ${response.status}`);
    return response.body as Value;
  }
}
export function names(value: unknown): string {
  return Array.isArray(value)
    ? value
        .map(item => text(pick(item, 'description') || pick(item, 'name') || item))
        .filter(Boolean)
        .join(', ')
    : '';
}
