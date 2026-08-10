import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

type Value = Record<string, unknown>;
export function object(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Value) : {};
}
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`nowcoder value must be an integer between 1 and ${maximum}`);
  return result;
}
export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`nowcoder ${name} cannot be empty`);
  return result;
}
export function stripHtml(value: unknown): string {
  return text(value)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .trim();
}
export class NowCoderClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async get(path: string): Promise<Value> {
    return this.#request(path, false);
  }
  async authenticatedGet(path: string): Promise<Value> {
    return this.#request(path, true);
  }
  async post(path: string, body: unknown): Promise<Value> {
    return this.#request(path, true, body);
  }
  async #request(path: string, withCookies: boolean, body?: unknown): Promise<Value> {
    const request: BrowserFetchRequest = {
      url: `https://gw-c.nowcoder.com/api/sparta/${path}`,
      headers: {
        accept: 'application/json',
        referer: 'https://www.nowcoder.com/',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined
        ? {}
        : {
            method: 'POST' as const,
            body: { encoding: 'utf8' as const, data: JSON.stringify(body) },
          }),
      responseType: 'json',
      withCookies,
    };
    const response = await this.#context.fetch(request);
    if (
      response.status < 200 ||
      response.status >= 300 ||
      response.bodyType !== 'json' ||
      !response.body ||
      typeof response.body !== 'object' ||
      Array.isArray(response.body)
    )
      throw new Error(`nowcoder request failed: HTTP ${response.status}`);
    const result = response.body as Value;
    if (pick(result, 'success') === false)
      throw new Error(text(pick(result, 'msg')) || 'nowcoder API request failed');
    return result;
  }
}
export function selected(body: Value, ...path: string[]): Value[] {
  let value: unknown = body;
  for (const key of path) value = pick(value, key);
  if (!Array.isArray(value) || !value.length)
    throw new Error(`nowcoder ${path.join('.')} returned no rows`);
  return value.filter(item => item && typeof item === 'object') as Value[];
}
