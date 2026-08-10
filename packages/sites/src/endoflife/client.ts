import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://endoflife.date/api';
const PRODUCT = /^[a-z0-9][a-z0-9._-]{0,79}$/;

export function requireProduct(value: unknown): string {
  const result = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!result) throw new Error('endoflife product is required');
  if (!PRODUCT.test(result))
    throw new Error(`endoflife product "${value}" is not a valid endoflife.date slug`);
  return result;
}
export function normaliseDateOrFlag(value: unknown): string | null {
  if (value === true) return 'ongoing';
  if (value === false || value == null) return null;
  if (typeof value === 'string') return value.trim() || null;
  return null;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export class EndOfLifeClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(url: string): Promise<unknown> {
    const request: BrowserFetchRequest = { url, responseType: 'json', withCookies: false };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`endoflife.date resource not found: ${url}`);
    if (response.status === 429) throw new Error('endoflife.date returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`endoflife.date request failed: HTTP ${response.status}`);
    return response.body;
  }
}
