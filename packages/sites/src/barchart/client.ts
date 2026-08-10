import type { SiteCommandContext } from '@panerelay/site-kit';
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
export function symbol(value: unknown): string {
  const result = text(value).toUpperCase();
  if (!/^[A-Z0-9.^/-]+$/.test(result)) throw new Error('barchart symbol is invalid');
  return result;
}
export function limit(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`barchart limit must be between 1 and ${maximum}`);
  return result;
}
export function fixed(value: unknown, digits: number, suffix = ''): number | string | null {
  if (value == null || value === '') return null;
  const result = Number(Number(value).toFixed(digits));
  return suffix ? `${result}${suffix}` : result;
}
export class BarchartClient {
  readonly #context: SiteCommandContext;
  #csrf = '';
  #referer = 'https://www.barchart.com/';
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async seed(path: string): Promise<void> {
    this.#referer = new URL(path, 'https://www.barchart.com').toString();
    const response = await this.#context.fetch({
      url: this.#referer,
      headers: { accept: 'text/html' },
      responseType: 'text',
      withCookies: true,
    });
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new Error(`barchart page failed: HTTP ${response.status}`);
    this.#csrf =
      String(response.body).match(
        /<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ??
      String(response.body).match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']csrf-token["']/i,
      )?.[1] ??
      '';
    if (!this.#csrf) throw new Error('barchart page returned no CSRF token');
  }
  async api(path: string): Promise<Value[]> {
    if (!this.#csrf) throw new Error('barchart client has not been seeded');
    const response = await this.#context.fetch({
      url: new URL(path, 'https://www.barchart.com').toString(),
      headers: {
        accept: 'application/json',
        origin: 'https://www.barchart.com',
        'x-csrf-token': this.#csrf,
        referer: this.#referer,
      },
      responseType: 'json',
      withCookies: true,
    });
    if (response.status === 401 || response.status === 403)
      throw new Error('barchart requires a valid browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`barchart API failed: HTTP ${response.status}`);
    const data = pick(response.body, 'data');
    if (!Array.isArray(data)) throw new Error('barchart API response is malformed');
    return data.map(item => object(pick(item, 'raw') ?? item));
  }
}
