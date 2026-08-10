import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://packagist.org';
type Value = Record<string, unknown>;
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`packagist ${label} cannot be empty`);
  return result;
}
export function boundedLimit(value: unknown, fallback: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 100)
    throw new Error('packagist limit must be an integer between 1 and 100');
  return result;
}
export function packageName(value: unknown): string {
  const result = required(value, 'package name').toLowerCase();
  const parts = result.split('/');
  if (
    parts.length !== 2 ||
    !parts.every(part => /^[a-z0-9]([_.-]?[a-z0-9]+)*$/.test(part) && part.length <= 100)
  )
    throw new Error(`packagist package "${value}" is not valid`);
  return result;
}
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function trimDate(value: unknown): string | null {
  const result = text(value);
  if (!result) return null;
  return result.replace(/\.\d+/, '').replace(/(?:[+-]\d{2}:?\d{2}|Z)?$/, 'Z');
}
export function stableVersion(value: unknown): string {
  const versions = value && typeof value === 'object' ? Object.keys(value) : [];
  const unstable = /(?:^|[._\-+])(?:dev|alpha|beta|rc|pre|nightly)(?:[._\-+\d]|$)/i;
  return (
    versions.find(version => !/\.x-dev$|-dev$/i.test(version) && !unstable.test(version)) ??
    versions[0] ??
    ''
  );
}
export class PackagistClient {
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
    if (response.status === 404) throw new Error(`packagist resource not found: ${path}`);
    if (response.status === 429) throw new Error('packagist returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`packagist request failed: HTTP ${response.status}`);
    return response.body;
  }
}
