import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://proxy.golang.org';
export type Row = Record<string, unknown>;
export function text(value: unknown): string {
  return String(value ?? '');
}
export function modulePath(value: unknown): string {
  const result = text(value).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(result) || !result.includes('/'))
    throw new Error(`goproxy module path "${value}" is not valid`);
  return result;
}
export function limit(value: unknown, fallback: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 200)
    throw new Error('goproxy limit must be an integer between 1 and 200');
  return result;
}
export function trimDate(value: unknown): string | null {
  const result = text(value).trim();
  return result ? result.replace(/\.\d+/, '').slice(0, 20) : null;
}
export function sortVersions(values: string[]): string[] {
  return values
    .filter(value => /^v\d+(\.\d+)*([-+][A-Za-z0-9._-]+)?$/.test(value))
    .sort((a, b) => {
      const parse = (value: string) =>
        (value.replace(/^v/, '').split('-')[0] ?? '').split('.').map(Number);
      const left = parse(a);
      const right = parse(b);
      for (let index = 0; index < Math.max(left.length, right.length); index += 1)
        if ((right[index] ?? 0) !== (left[index] ?? 0))
          return (right[index] ?? 0) - (left[index] ?? 0);
      return a.includes('-') === b.includes('-') ? a.localeCompare(b) : a.includes('-') ? 1 : -1;
    });
}

export class GoProxyClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(path: string, responseType: 'json' | 'text'): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      responseType,
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404 || response.status === 410)
      throw new Error(`goproxy resource not found: ${path}`);
    if (response.status === 429) throw new Error('goproxy returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== responseType)
      throw new Error(`goproxy request failed: HTTP ${response.status}`);
    return response.body;
  }
  async json(path: string): Promise<Row> {
    return (await this.request(path, 'json')) as Row;
  }
  async text(path: string): Promise<string> {
    return String(await this.request(path, 'text'));
  }
}
