import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const OEIS_BASE = 'https://oeis.org';
type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`oeis ${label} cannot be empty`);
  return result;
}
export function boundedLimit(value: unknown, fallback = 10): number {
  const result = value == null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 100)
    throw new Error('oeis limit must be an integer between 1 and 100');
  return result;
}
export function sequenceId(value: unknown): string {
  const raw = text(value)
    .toUpperCase()
    .replace(/^HTTPS?:\/\/(?:WWW\.)?OEIS\.ORG\//, '')
    .replace(/\/.*$/, '');
  if (!/^A\d{1,7}$/.test(raw)) throw new Error(`oeis sequence id "${value}" is not valid`);
  return raw;
}
export function formatId(value: unknown): string {
  return typeof value === 'number' && Number.isInteger(value)
    ? `A${String(value).padStart(6, '0')}`
    : '';
}
export function preview(value: unknown): string {
  const terms = text(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return terms.length > 12
    ? `${terms.slice(0, 12).join(', ')}, (+${terms.length - 12})`
    : terms.join(', ');
}
export class OeisClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(path: string, query: Record<string, string> = {}): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${OEIS_BASE}${path}`,
      query: Object.entries(query).map(([name, value]) => ({ name, value })),
      headers: { Accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`oeis resource not found: ${path}`);
    if (response.status === 429) throw new Error('oeis returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`oeis request failed: HTTP ${response.status}`);
    return response.body;
  }
}
