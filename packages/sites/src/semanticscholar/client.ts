import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const GRAPH_BASE = 'https://api.semanticscholar.org/graph/v1';
export const RECOMMENDATIONS_BASE = 'https://api.semanticscholar.org/recommendations/v1';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`semanticscholar ${label} cannot be empty`);
  return result;
}

export function bounded(value: unknown, fallback: number, max: number, label = 'limit'): number {
  const result = value == null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > max)
    throw new Error(`semanticscholar ${label} must be an integer between 1 and ${max}`);
  return result;
}

export function paperRef(value: unknown): string {
  const raw = required(value, 'paper id');
  const url = raw.match(
    /^https?:\/\/(?:www\.)?semanticscholar\.org\/paper\/(?:[^/]+\/)?([0-9a-f]{40})/i,
  );
  if (url?.[1]) return url[1].toLowerCase();
  if (/^[0-9a-f]{40}$/i.test(raw)) return raw.toLowerCase();
  if (/^(?:ARXIV|MAG|ACL|PMID|PMCID|URL|CorpusId|DBLP):/i.test(raw)) return raw;
  if (/^doi:/i.test(raw)) return `DOI:${raw.replace(/^doi:/i, '').trim()}`;
  const doiUrl = raw.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i);
  if (doiUrl) return `DOI:${doiUrl[1]}`;
  if (/^10\.\S+$/.test(raw)) return `DOI:${raw}`;
  if (/^\d{4}\.\d{4,5}(?:v\d+)?$/.test(raw) || /^[a-z-]+\/\d{7}(?:v\d+)?$/i.test(raw))
    return `ARXIV:${raw}`;
  throw new Error(`semanticscholar paper id "${value}" is not recognised`);
}

export function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('semanticscholar numeric field is invalid');
  return value;
}

export function firstAuthor(value: unknown): string {
  if (!Array.isArray(value) || !value.length) return '';
  return text(pick(value[0], 'name'));
}

export function tldr(value: unknown): string {
  return text(pick(value, 'text'));
}

export function paperRow(value: unknown, label: string, rank?: number): Record<string, unknown> {
  const paperId = text(pick(value, 'paperId'));
  const title = text(pick(value, 'title'));
  if (!paperId || !title)
    throw new Error(`semanticscholar ${label} row is missing paperId or title`);
  const row = {
    paperId,
    doi: text(pick(pick(value, 'externalIds'), 'DOI')),
    title,
    year: numberOrNull(pick(value, 'year')),
    firstAuthor: firstAuthor(pick(value, 'authors')),
    citationCount: numberOrNull(pick(value, 'citationCount')),
    url: text(pick(value, 'url')) || `https://www.semanticscholar.org/paper/${paperId}`,
  };
  return rank == null ? row : { rank, ...row };
}

export class SemanticScholarClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(url: string, query: Array<{ name: string; value: string }> = []): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url,
      query,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`semanticscholar resource not found: ${url}`);
    if (response.status === 429)
      throw new Error('semanticscholar returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`semanticscholar request failed: HTTP ${response.status}`);
    return response.body;
  }
}
