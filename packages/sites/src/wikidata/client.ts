import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://www.wikidata.org';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`wikidata ${label} cannot be empty`);
  return result;
}
export function language(value: unknown): string {
  const result = text(value || 'en').toLowerCase();
  if (!/^[a-z]{2,3}(?:-[a-z]{2,8})?$/.test(result))
    throw new Error(`wikidata language "${value}" is not valid`);
  return result;
}
export function bounded(value: unknown, fallback = 20): number {
  const result = value == null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 50)
    throw new Error('wikidata limit must be an integer between 1 and 50');
  return result;
}
export function entityId(value: unknown): string {
  const raw = required(value, 'entity id')
    .toUpperCase()
    .replace(/^HTTPS?:\/\/[^/]+\/WIKI\//i, '');
  if (!/^[QPL]\d+$/.test(raw)) throw new Error(`wikidata entity id "${value}" is not valid`);
  return raw;
}
export function localised(value: unknown, lang: string): string | null {
  const direct = pick(pick(value, lang), 'value');
  if (text(direct)) return text(direct);
  const fallback = pick(pick(value, 'en'), 'value');
  return text(fallback) || null;
}
export function aliases(value: unknown, lang: string): string {
  const preferred = pick(value, lang);
  const fallback = pick(value, 'en');
  const list =
    Array.isArray(preferred) && preferred.length
      ? preferred
      : Array.isArray(fallback)
        ? fallback
        : [];
  const names = list.map(item => text(pick(item, 'value'))).filter(Boolean);
  return names.length > 5
    ? [...names.slice(0, 5), `(+${names.length - 5})`].join(', ')
    : names.join(', ');
}

export class WikidataClient {
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
    if (response.status === 404) throw new Error(`wikidata resource not found: ${path}`);
    if (response.status === 429) throw new Error('wikidata returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`wikidata request failed: HTTP ${response.status}`);
    return response.body;
  }
}
