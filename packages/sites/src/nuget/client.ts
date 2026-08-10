import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const SEARCH_BASE = 'https://azuresearch-usnc.nuget.org';
export const REGISTRATION_BASE = 'https://api.nuget.org/v3/registration5-semver1';
type Value = Record<string, unknown>;
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`nuget ${label} cannot be empty`);
  return result;
}
export function boundedLimit(value: unknown, fallback: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 1000)
    throw new Error('nuget limit must be an integer between 1 and 1000');
  return result;
}
export function packageId(value: unknown): string {
  const result = required(value, 'package id');
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/.test(result))
    throw new Error(`nuget package id "${value}" is not valid`);
  return result;
}
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function join(value: unknown): string {
  return Array.isArray(value)
    ? value.filter(item => typeof item === 'string' && item.trim()).join(', ')
    : text(value);
}
export class NugetClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(url: string, query: Record<string, string | number> = {}): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url,
      query: Object.entries(query).map(([name, value]) => ({ name, value: String(value) })),
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`nuget resource not found: ${url}`);
    if (response.status === 429) throw new Error('nuget returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`nuget request failed: HTTP ${response.status}`);
    return response.body;
  }
}
