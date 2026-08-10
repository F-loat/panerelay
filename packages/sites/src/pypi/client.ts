import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const PYPI_BASE = 'https://pypi.org';
export const STATS_BASE = 'https://pypistats.org';
type Value = Record<string, unknown>;
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function packageName(value: unknown): string {
  const result = text(value);
  if (!/^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(result))
    throw new Error(`pypi package name "${value}" is not valid`);
  return result;
}
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function period(value: unknown): 'recent' | 'overall' {
  const result = text(value || 'recent').toLowerCase();
  if (result !== 'recent' && result !== 'overall')
    throw new Error(`pypi downloads period "${value}" is invalid`);
  return result;
}
export class PypiClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(base: string, path: string, query: Record<string, string> = {}): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${base}${path}`,
      query: Object.entries(query).map(([name, value]) => ({ name, value })),
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`pypi resource not found: ${path}`);
    if (response.status === 429) throw new Error('pypi returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`pypi request failed: HTTP ${response.status}`);
    return response.body;
  }
}
