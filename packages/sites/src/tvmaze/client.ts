import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://api.tvmaze.com';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`tvmaze ${label} cannot be empty`);
  return result;
}

export function bounded(value: unknown, fallback: number, max: number): number {
  const result = value == null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > max)
    throw new Error(`tvmaze limit must be an integer between 1 and ${max}`);
  return result;
}

export function showId(value: unknown): number {
  const result = Number(text(value));
  if (!Number.isInteger(result) || result <= 0)
    throw new Error('tvmaze show id must be a positive integer');
  return result;
}

export function joinList(value: unknown): string {
  return Array.isArray(value) ? value.filter(Boolean).map(String).join(', ') : '';
}

export function stripHtml(value: unknown): string {
  let result = text(value).replace(/<[^>]+>/g, '');
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    hellip: '…',
    ndash: '–',
    mdash: '—',
  };
  result = result
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&([a-zA-Z]+);/g, (match: string, name: string) => entities[name] ?? match);
  return result.replace(/\s+/g, ' ').trim();
}

export function networkName(show: unknown): string {
  return text(pick(pick(show, 'network'), 'name')) || text(pick(pick(show, 'webChannel'), 'name'));
}

export function countryName(show: unknown): string {
  return (
    text(pick(pick(pick(show, 'network'), 'country'), 'name')) ||
    text(pick(pick(pick(show, 'webChannel'), 'country'), 'name'))
  );
}

export class TvmazeClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(
    path: string,
    query: Array<{ name: string; value: string }> = [],
  ): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      query,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`tvmaze resource not found: ${path}`);
    if (response.status === 429) throw new Error('tvmaze returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`tvmaze request failed: HTTP ${response.status}`);
    return response.body;
  }
}
