import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const API_ORIGIN = 'https://hacker-news.firebaseio.com/v0';
export const SEARCH_ORIGIN = 'https://hn.algolia.com/api/v1';
export type AdapterArgs = Record<string, string | number | boolean>;
export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function stringValue(value: unknown): string {
  return value == null ? '' : String(value);
}

export function positiveInteger(
  value: unknown,
  label: string,
  defaultValue: number,
  maximum = 50,
): number {
  const selected = value == null || value === '' ? defaultValue : Number(value);
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  }
  return selected;
}

export function requiredString(args: AdapterArgs, name: string): string {
  const value = stringValue(args[name]).trim();
  if (!value) throw new Error(`Hacker News ${name} is required`);
  return value;
}

function responseJson(
  response: { status: number; bodyType: string; body: unknown },
  label: string,
) {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Hacker News ${label} request returned HTTP ${response.status}`);
  }
  if (response.bodyType !== 'json') throw new Error(`Hacker News ${label} response is not JSON`);
  return response.body;
}

export class HackerNewsClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async get(path: string, query: Record<string, string | number> = {}): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${API_ORIGIN}${path}`,
      query: Object.entries(query).map(([name, value]) => ({ name, value: String(value) })),
      responseType: 'json',
      withCookies: false,
    };
    return responseJson(await this.#context.fetch(request), path);
  }

  async search(path: string, query: Record<string, string | number>): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${SEARCH_ORIGIN}${path}`,
      query: Object.entries(query).map(([name, value]) => ({ name, value: String(value) })),
      responseType: 'json',
      withCookies: false,
    };
    return responseJson(await this.#context.fetch(request), path);
  }
}

export function storyRow(item: JsonObject, rank: number) {
  return {
    rank,
    id: item.id ?? '',
    title: stringValue(item.title),
    score: item.score ?? 0,
    author: stringValue(item.by),
    comments: item.descendants ?? 0,
    url: stringValue(item.url) || `https://news.ycombinator.com/item?id=${item.id ?? ''}`,
  };
}

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

export async function storyList(
  client: HackerNewsClient,
  path: string,
  args: AdapterArgs,
  label: string,
) {
  const limit = positiveInteger(args.limit, `Hacker News ${label} limit`, 20);
  const ids = await client.get(path);
  if (!Array.isArray(ids)) throw new Error(`Hacker News ${label} list is malformed`);
  const rows = await mapWithConcurrency(ids.slice(0, Math.min(limit + 10, 50)), 4, async id => {
    const item = await client.get(`/item/${id}.json`);
    return isObject(item) && item.title && !item.deleted && !item.dead ? item : undefined;
  });
  return rows
    .filter((item): item is JsonObject => !!item)
    .slice(0, limit)
    .map((item, index) => storyRow(item, index + 1));
}
