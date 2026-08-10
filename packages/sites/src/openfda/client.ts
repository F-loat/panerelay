import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const API_BASE = 'https://api.fda.gov';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`openfda ${label} cannot be empty`);
  return result;
}

export function boundedLimit(value: unknown, fallback: number, max: number): number {
  const result = value == null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > max)
    throw new Error(`openfda limit must be an integer between 1 and ${max}`);
  return result;
}

export function firstOrNull(value: unknown): string | null {
  if (!Array.isArray(value) || !value.length) return null;
  const result = text(value[0]);
  return result || null;
}

export function joinOrNull(value: unknown, max = 5): string | null {
  if (!Array.isArray(value) || !value.length) return null;
  const result = value
    .slice(0, max)
    .map(item => text(item))
    .filter(Boolean)
    .join(', ');
  return result || null;
}

export class OpenFdaClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async request(path: string, query: Array<{ name: string; value: string }>): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${API_BASE}${path}`,
      query,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error('openfda no matching records');
    if (response.status === 429) throw new Error('openfda returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`openfda request failed: HTTP ${response.status}`);
    return response.body;
  }
}
