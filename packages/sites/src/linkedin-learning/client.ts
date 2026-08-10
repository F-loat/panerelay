import { SiteError, type SiteCommandContext } from '@panerelay/site-kit';
export type Value = Record<string, unknown>;
export function object(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Value) : {};
}
export function pick(value: unknown, key: string): unknown {
  return object(value)[key];
}
export function text(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
export function limit(value: unknown, fallback = 10): number {
  const result = value == null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 50)
    throw new Error('linkedin-learning limit must be between 1 and 50');
  return result;
}
export function slug(value: unknown): string {
  let result = text(value);
  if (!result) throw new Error('linkedin-learning slug is required');
  if (/^https?:\/\//i.test(result)) {
    const url = new URL(result);
    const match = url.pathname.match(/^\/learning\/([^/?#]+)/);
    if (!['linkedin.com', 'www.linkedin.com'].includes(url.hostname) || !match?.[1])
      throw new Error('linkedin-learning URL is invalid');
    result = match[1];
  } else result = result.match(/^\/?learning\/([^/?#]+)/)?.[1] ?? result;
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new Error('linkedin-learning slug is invalid');
  return result;
}
export class LearningClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async get(path: string): Promise<Value> {
    const response = await this.#context.fetch({
      url: new URL(path, 'https://www.linkedin.com').toString(),
      headers: {
        accept: 'application/json',
        'x-restli-protocol-version': '2.0.0',
        referer: 'https://www.linkedin.com/learning/',
      },
      bindings: ['linkedin-learning-csrf'],
      responseType: 'json',
      withCookies: true,
    });
    if (response.status === 401 || response.status === 403)
      throw new SiteError(
        'auth-required',
        'LinkedIn Learning requires a valid logged-in browser session',
      );
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`linkedin-learning request failed: HTTP ${response.status}`);
    return object(response.body);
  }
}
export function authors(value: unknown): string {
  return Array.isArray(value)
    ? value
        .map(item => `${text(pick(item, 'firstName'))} ${text(pick(item, 'lastName'))}`.trim())
        .filter(Boolean)
        .join(', ')
    : '';
}
export function duration(value: unknown): string {
  const span = object(pick(value, 'com.linkedin.common.TimeSpan'));
  return pick(span, 'unit') === 'SECOND' ? text(pick(span, 'duration')) : '';
}
export function rating(value: unknown): string {
  const data = object(value);
  const average = Number(pick(data, 'averageRating'));
  if (Number.isFinite(average)) return average.toFixed(2);
  const sum = Number(pick(data, 'ratingSum'));
  const count = Number(pick(data, 'ratingCount'));
  return Number.isFinite(sum) && count > 0 ? (sum / count).toFixed(2) : '';
}
