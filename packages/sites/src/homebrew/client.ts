import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://formulae.brew.sh/api';
type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function token(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`homebrew ${label} cannot be empty`);
  if (result.length > 100 || !/^[A-Za-z0-9][A-Za-z0-9._+@-]*$/.test(result))
    throw new Error(`homebrew ${label} is not a valid token`);
  return result;
}
export function bounded(value: unknown): number {
  const result = value == null ? 30 : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 500)
    throw new Error('homebrew limit must be an integer between 1 and 500');
  return result;
}
export function oneOf(value: unknown, values: string[], fallback: string, label: string): string {
  const result = text(value || fallback).toLowerCase();
  if (!values.includes(result))
    throw new Error(`homebrew ${label} must be one of: ${values.join(', ')}`);
  return result;
}
export function installCount(value: unknown): number | null {
  const result = Number(text(value).replace(/,/g, ''));
  return Number.isFinite(result) && text(value) ? result : null;
}

export class HomebrewClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(path: string): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`homebrew resource not found: ${path}`);
    if (response.status === 429) throw new Error('homebrew returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`homebrew request failed: HTTP ${response.status}`);
    return response.body;
  }
}
