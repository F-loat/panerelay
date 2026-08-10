import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://api.llama.fi';
export type Row = Record<string, unknown>;
export function text(value: unknown): string {
  return String(value ?? '');
}
export function limit(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`defillama limit must be an integer between 1 and ${maximum}`);
  return result;
}
export function slug(value: unknown): string {
  const result = text(value).trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(result))
    throw new Error(`defillama slug "${value}" is not valid`);
  return result;
}
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Row)[key] : undefined;
}
export function date(value: unknown): string | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const result = new Date(number > 1e12 ? number : number * 1000);
  return Number.isNaN(result.getTime()) ? null : result.toISOString().slice(0, 10);
}

export class DefiLlamaClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(path: string): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`defillama resource not found: ${path}`);
    if (response.status === 429) throw new Error('defillama returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`defillama request failed: HTTP ${response.status}`);
    return response.body;
  }
}
