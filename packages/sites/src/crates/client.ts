import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://crates.io';
export type Row = Record<string, unknown>;

export function text(value: unknown): string {
  return String(value ?? '');
}
export function required(value: unknown, label: string): string {
  const result = text(value).trim();
  if (!result) throw new Error(`crates ${label} cannot be empty`);
  return result;
}
export function crateName(value: unknown): string {
  const result = required(value, 'crate name');
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(result))
    throw new Error(`crates crate name "${value}" is not valid`);
  return result;
}
export function boundedLimit(value: unknown, fallback: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 100)
    throw new Error('crates limit must be an integer between 1 and 100');
  return result;
}
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Row)[key] : undefined;
}

export class CratesClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(path: string, query: Record<string, string | number> = {}): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      query: Object.entries(query).map(([name, value]) => ({ name, value: String(value) })),
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`crates resource not found: ${path}`);
    if (response.status === 429) throw new Error('crates returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`crates request failed: HTTP ${response.status}`);
    return response.body;
  }
}
