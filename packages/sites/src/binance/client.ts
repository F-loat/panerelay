import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://data-api.binance.vision/api/v3';
export function required(value: unknown, label: string): string {
  const result = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!result) throw new Error(`binance ${label} is required`);
  return result;
}
export function bounded(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`binance limit must be an integer between 1 and ${maximum}`);
  return result;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function number(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}
export class BinanceClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(
    path: string,
    query: Array<{ name: string; value: string | number }> = [],
  ): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}/${path}`,
      query: query.map(item => ({ name: item.name, value: String(item.value) })),
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`binance request failed: HTTP ${response.status}`);
    return response.body;
  }
}
