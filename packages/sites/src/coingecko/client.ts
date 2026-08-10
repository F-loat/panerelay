import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://api.coingecko.com/api/v3';
export type Row = Record<string, unknown>;

export function requiredSlug(value: unknown, label: string): string {
  const result = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!result) throw new Error(`coingecko ${label} cannot be empty`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(result))
    throw new Error(`coingecko ${label} must look like a slug`);
  return result;
}

export function currency(value: unknown): string {
  const result = String(value ?? 'usd')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9-]{2,20}$/.test(result))
    throw new Error(`coingecko currency must look like a currency slug (got "${value}")`);
  return result;
}

export function limit(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`coingecko limit must be an integer between 1 and ${maximum}`);
  return result;
}

export function positive(value: unknown, fallback: number, label: string): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1)
    throw new Error(`coingecko ${label} must be a positive integer`);
  return result;
}

export function number(value: unknown): number | null {
  return value == null ? null : Number(value);
}
export function text(value: unknown): string {
  return String(value ?? '');
}
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? ((value as Row)[key] ?? null) : null;
}

export class CoinGeckoClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(path: string, query: Record<string, string | number> = {}): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}/${path}`,
      query: Object.entries(query).map(([name, value]) => ({ name, value: String(value) })),
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`coingecko resource not found: ${path}`);
    if (response.status === 429) throw new Error('coingecko returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`coingecko request failed: HTTP ${response.status}`);
    return response.body;
  }
}
