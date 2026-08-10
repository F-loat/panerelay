import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const API = 'https://api2.openreview.net';
export const WEB = 'https://openreview.net';
export type Row = Record<string, unknown>;
export function text(value: unknown): string {
  return String(value ?? '');
}
export function required(value: unknown, label: string): string {
  const result = text(value).trim();
  if (!result) throw new Error(`openreview ${label} cannot be empty`);
  return result;
}
export function limit(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`openreview limit must be an integer between 1 and ${maximum}`);
  return result;
}
export function offset(value: unknown): number {
  const result = value == null || value === '' ? 0 : Number(value);
  if (!Number.isInteger(result) || result < 0)
    throw new Error('openreview offset must be a non-negative integer');
  return result;
}
export function forumId(value: unknown, label = 'id'): string {
  const result = required(value, label);
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(result)) throw new Error(`openreview ${label} is not valid`);
  return result;
}
export function profileId(value: unknown): string {
  const result = required(value, 'profile');
  if (!/^~(?=.*\p{L})[\p{L}\p{M}0-9._-]+\d+$/u.test(result))
    throw new Error('openreview profile is not valid');
  return result;
}
export function pick(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const key of path.split('.'))
    current = current && typeof current === 'object' ? (current as Row)[key] : undefined;
  return current;
}
export function content(note: unknown, key: string): unknown {
  return pick(note, `content.${key}.value`);
}
export function date(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? new Date(value).toISOString().slice(0, 10)
    : '';
}
export function noteRow(note: unknown): Row {
  const authors = content(note, 'authors');
  const ids = content(note, 'authorids');
  const authorList =
    Array.isArray(authors) && authors.length
      ? authors
      : Array.isArray(ids)
        ? ids.map(value => text(value).replace(/^~/, '').replace(/\d+$/, '').replace(/_/g, ' '))
        : [];
  const keywords = content(note, 'keywords');
  const id = text(pick(note, 'id'));
  const pdf = text(content(note, 'pdf'));
  return {
    id,
    title: text(content(note, 'title')).replace(/\s+/g, ' ').trim(),
    authors: authorList.join(', '),
    keywords: Array.isArray(keywords) ? keywords.join(', ') : text(keywords),
    venue: text(content(note, 'venue')),
    venueid: text(content(note, 'venueid')),
    primary_area: text(content(note, 'primary_area')),
    abstract: text(content(note, 'abstract')).replace(/\s+/g, ' ').trim(),
    pdate: date(pick(note, 'pdate') ?? pick(note, 'cdate')),
    pdf: pdf.startsWith('http') ? pdf : pdf ? `${WEB}${pdf.startsWith('/') ? '' : '/'}${pdf}` : '',
    url: id ? `${WEB}/forum?id=${id}` : '',
  };
}

export class OpenReviewClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(path: string): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${API}${path}`,
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) return null;
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`openreview request failed: HTTP ${response.status}`);
    return response.body;
  }
}
