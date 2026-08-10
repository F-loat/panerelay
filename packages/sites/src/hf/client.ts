import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`hf limit must be an integer between 1 and ${maximum}`);
  return result;
}
export class HuggingFaceClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async get(path: string): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `https://huggingface.co${path}`,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 429) throw new Error('huggingface returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`huggingface request failed: HTTP ${response.status}`);
    return response.body;
  }
}
export function listRows(value: unknown, label: string): Value[] {
  if (!Array.isArray(value) || !value.length) throw new Error(`${label} returned no results`);
  return value.filter(row => row && typeof row === 'object') as Value[];
}
export function baseRow(item: Value, rank: number, prefix = ''): Value {
  const id = text(pick(item, 'id') || pick(item, 'modelId'));
  const slash = id.indexOf('/');
  return {
    rank,
    id,
    author: text(pick(item, 'author')) || (slash > 0 ? id.slice(0, slash) : ''),
    downloads: Number(pick(item, 'downloads')) || 0,
    likes: Number(pick(item, 'likes')) || 0,
    tags: Array.isArray(pick(item, 'tags'))
      ? (pick(item, 'tags') as unknown[])
          .filter(value => !text(value).startsWith('license:'))
          .slice(0, 10)
          .join(', ')
      : '',
    lastModified: text(pick(item, 'lastModified')).slice(0, 10),
    url: id ? `https://huggingface.co/${prefix}${id}` : '',
  };
}
