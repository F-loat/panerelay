import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const ARCHIVE_BASE = 'https://archive.org';
export const IDENTIFIER = /^[A-Za-z0-9._-]+$/;

export type QueryValue = string | number;

export function required(value: unknown, label: string): string {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`archive ${label} cannot be empty`);
  return result;
}

export function bounded(value: unknown, fallback: number, maximum: number, label: string): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`archive ${label} must be an integer between 1 and ${maximum}`);
  return result;
}

export function identifier(value: unknown): string {
  const result = required(value, 'identifier');
  if (!IDENTIFIER.test(result)) throw new Error(`archive item identifier "${value}" is not valid`);
  return result;
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function listText(value: unknown): string {
  return Array.isArray(value) ? value.map(text).filter(Boolean).join(', ') : text(value);
}

export class ArchiveClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async json(
    url: string,
    query: Array<{ name: string; value: QueryValue }> = [],
  ): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url,
      query: query.map(item => ({ name: item.name, value: String(item.value) })),
      headers: { Accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`archive request failed: HTTP ${response.status}`);
    return response.body;
  }
}
