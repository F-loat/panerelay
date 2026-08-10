import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://search.maven.org/solrsearch/select';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`maven ${label} cannot be empty`);
  return result;
}
export function bounded(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum)
    throw new Error(`maven limit must be an integer between 1 and ${maximum}`);
  return result;
}
export function coordinate(value: unknown): {
  groupId: string;
  artifactId: string;
  version: string | null;
} {
  const parts = text(value).split(':');
  if (parts.length < 2 || parts.length > 3 || !parts[0] || !parts[1])
    throw new Error('maven coordinate must be groupId:artifactId[:version]');
  if (![parts[0], parts[1]].every(part => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part!)))
    throw new Error('maven groupId and artifactId must be valid tokens');
  if (parts[2] != null && !parts[2]) throw new Error('maven version cannot be empty');
  return { groupId: parts[0]!, artifactId: parts[1]!, version: parts[2] ?? null };
}
export function iso(value: unknown): string | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? new Date(number).toISOString().replace(/\.\d+Z$/, 'Z')
    : null;
}

export class MavenClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async search(query: string, rows: number): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: BASE,
      query: [
        { name: 'q', value: query },
        { name: 'rows', value: String(rows) },
        { name: 'wt', value: 'json' },
      ],
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error('maven resource not found');
    if (response.status === 429) throw new Error('maven returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`maven request failed: HTTP ${response.status}`);
    return response.body;
  }
}

export function docs(body: unknown): unknown[] {
  const response = pick(body, 'response');
  const value = pick(response, 'docs');
  return Array.isArray(value) ? value : [];
}
