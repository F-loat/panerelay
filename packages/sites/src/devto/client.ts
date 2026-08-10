import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const DEVTO_BASE = 'https://dev.to/api';
type Value = Record<string, unknown>;

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}

export function boundedInt(value: unknown, fallback: number, max: number, label: string): number {
  const result = value == null ? fallback : typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(result) || result <= 0 || result > max) {
    throw new Error(`devto ${label} must be a positive integer <= ${max}`);
  }
  return result;
}

export function articleId(value: unknown): string {
  const result = text(value);
  if (!/^\d+$/.test(result)) throw new Error(`devto article id "${value}" is not valid`);
  return result;
}

export class DevtoClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(path: string, query: Record<string, string> = {}): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${DEVTO_BASE}${path}`,
      query: Object.entries(query).map(([name, value]) => ({ name, value })),
      headers: { Accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`devto resource not found: ${path}`);
    if (response.status === 429) throw new Error('devto returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json') {
      throw new Error(`devto request failed: HTTP ${response.status}`);
    }
    return response.body;
  }
}
