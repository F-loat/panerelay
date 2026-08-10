import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://api.openalex.org';
const WORK_ID = /^W\d{4,}$/;
const DOI = /^10\.\S+$/;

export function required(value: unknown, label: string): string {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`openalex ${label} cannot be empty`);
  return result;
}
export function bounded(
  value: unknown,
  fallback: number,
  maximum: number,
  label = 'limit',
): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`openalex ${label} must be an integer between 1 and ${maximum}`);
  return result;
}
export function workRef(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('openalex work id is required');
  const openalex = raw.match(
    /^https?:\/\/(?:api\.)?openalex\.org\/(?:works\/)?([WAaSCFwIPwT]\d+)/i,
  );
  if (openalex) {
    const id = openalex[1]!.toUpperCase();
    if (!id.startsWith('W')) throw new Error(`openalex work id must be a Work (W) ID`);
    return id;
  }
  if (WORK_ID.test(raw.toUpperCase())) return raw.toUpperCase();
  if (/^doi:/i.test(raw) && DOI.test(raw.replace(/^doi:/i, '').trim()))
    return `doi:${raw.replace(/^doi:/i, '').trim()}`;
  const doiUrl = raw.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i)?.[1] ?? raw;
  if (DOI.test(doiUrl)) return `doi:${doiUrl}`;
  throw new Error(`openalex work id "${value}" is not recognised`);
}
export function bareId(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^https?:\/\/(?:api\.)?openalex\.org\//i, '')
    .replace(/^works\//i, '');
}
export function bareDoi(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
}
export function abstract(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const positions: string[] = [];
  for (const [token, indexes] of Object.entries(value as Record<string, unknown>))
    if (Array.isArray(indexes))
      for (const index of indexes)
        if (Number.isInteger(index) && (index as number) >= 0 && (index as number) < 100000)
          positions[index as number] = token;
  return positions.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function number(value: unknown): number | null {
  return value == null ? null : Number(value);
}

export class OpenAlexClient {
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
    if (response.status === 404) throw new Error(`OpenAlex resource not found: ${url}`);
    if (response.status === 429) throw new Error('OpenAlex returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`OpenAlex request failed: HTTP ${response.status}`);
    return response.body;
  }
}
