import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://api.stackexchange.com/2.3';
type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`stackoverflow ${label} cannot be empty`);
  return result;
}
export function integer(
  value: unknown,
  fallback: number,
  maximum: number,
  label = 'limit',
): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`stackoverflow ${label} must be an integer between 1 and ${maximum}`);
  return result;
}
export function date(value: unknown): string {
  const result = Number(value);
  return Number.isFinite(result) && result > 0
    ? new Date(result * 1000).toISOString().slice(0, 10)
    : '';
}
export function entities(value: unknown): string {
  return text(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(
      /&(amp|lt|gt|quot|#39|apos|nbsp);/g,
      match =>
        ({
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&#39;': "'",
          '&apos;': "'",
          '&nbsp;': ' ',
        })[match] || match,
    );
}
export function html(value: unknown): string {
  return entities(
    text(value)
      .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n$1\n')
      .replace(/<p[^>]*>/gi, '\n\n')
      .replace(/<\/p>/gi, '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
export function items(body: Value, label: string): Value[] {
  const value = pick(body, 'items');
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} returned no items`);
  return value.filter(item => item && typeof item === 'object') as Value[];
}
export function question(item: Value, rank: number): Value {
  const id = pick(item, 'question_id');
  return {
    rank,
    id,
    title: entities(pick(item, 'title')),
    score: Number(pick(item, 'score')) || 0,
    answers: Number(pick(item, 'answer_count')) || 0,
    views: Number(pick(item, 'view_count')) || 0,
    isAnswered: Boolean(pick(item, 'is_answered')),
    tags: Array.isArray(pick(item, 'tags')) ? (pick(item, 'tags') as unknown[]).join(', ') : '',
    author: entities(pick(pick(item, 'owner'), 'display_name')),
    createdAt: date(pick(item, 'creation_date')),
    lastActivityAt: date(pick(item, 'last_activity_date')),
    url: text(pick(item, 'link')) || `https://stackoverflow.com/questions/${text(id)}`,
  };
}
export class StackOverflowClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async get(path: string, params: Record<string, unknown> = {}): Promise<Value> {
    const url = new URL(path.startsWith('http') ? path : `${BASE}${path}`);
    url.searchParams.set('site', 'stackoverflow');
    for (const [key, value] of Object.entries(params))
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    const request: BrowserFetchRequest = {
      url: url.toString(),
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 429) throw new Error('stackoverflow returned HTTP 429 (rate limited)');
    if (
      response.status < 200 ||
      response.status >= 300 ||
      response.bodyType !== 'json' ||
      !response.body ||
      typeof response.body !== 'object' ||
      Array.isArray(response.body)
    )
      throw new Error(`stackoverflow request failed: HTTP ${response.status}`);
    const body = response.body as Value;
    if (pick(body, 'error_id'))
      throw new Error(`stackoverflow API error: ${text(pick(body, 'error_message'))}`);
    return body;
  }
}
