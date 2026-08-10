import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://rubygems.org/api/v1';
type Value = Record<string, unknown>;
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`rubygems ${label} cannot be empty`);
  return result;
}
export function boundedLimit(value: unknown, fallback: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 100)
    throw new Error('rubygems limit must be an integer between 1 and 100');
  return result;
}
export function gemName(value: unknown): string {
  const result = required(value, 'gem name');
  if (result.length > 100 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(result))
    throw new Error(`rubygems gem "${value}" is not valid`);
  return result;
}
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function trimDate(value: unknown): string | null {
  const result = text(value);
  if (!result) return null;
  const normalized = result.replace(/\.\d+/, '');
  return normalized.endsWith('Z') ? normalized : `${normalized}Z`;
}
export function licenses(value: unknown): string {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : '';
}
export class RubyGemsClient {
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
    if (response.status === 404) throw new Error(`rubygems resource not found: ${path}`);
    if (response.status === 429) throw new Error('rubygems returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`rubygems request failed: HTTP ${response.status}`);
    return response.body;
  }
}
