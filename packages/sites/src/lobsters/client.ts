import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://lobste.rs';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}

export function text(value: unknown): string {
  return String(value ?? '');
}

export function positive(value: unknown, label: string, fallback: number, maximum = 50): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw new Error(`lobsters ${label} must be an integer between 1 and ${maximum}`);
  }
  return result;
}

export function slug(value: unknown, label: string): string {
  const result = text(value).trim().toLowerCase();
  if (!result || !/^[a-z0-9][a-z0-9-]*$/.test(result))
    throw new Error(`lobsters ${label} must be a lowercase tag`);
  return result;
}

export function hostname(value: unknown): string {
  const result = text(value).trim().toLowerCase();
  if (
    !result ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      result,
    )
  ) {
    throw new Error('lobsters domain must be a valid hostname');
  }
  return result;
}

export function storyRow(item: unknown, rank: number) {
  return {
    rank,
    id: text(pick(item, 'short_id')),
    title: text(pick(item, 'title')),
    score: pick(item, 'score') ?? 0,
    author: text(pick(item, 'submitter_user')),
    comments: pick(item, 'comment_count') ?? 0,
    created_at: text(pick(item, 'created_at')),
    tags: Array.isArray(pick(item, 'tags')) ? (pick(item, 'tags') as unknown[]).join(', ') : '',
    url: text(pick(item, 'comments_url')),
  };
}

function responseJson(response: { status: number; bodyType: string; body: unknown }, path: string) {
  if (response.status === 404) throw new Error(`lobsters resource not found: ${path}`);
  if (response.status < 200 || response.status >= 300)
    throw new Error(`lobsters request failed: HTTP ${response.status}`);
  if (response.bodyType !== 'json') throw new Error(`lobsters response is not JSON: ${path}`);
  return response.body;
}

export class LobstersClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async get(path: string): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      headers: { accept: 'application/json', 'user-agent': 'Panerelay Lobste.rs adapter' },
      responseType: 'json',
      withCookies: false,
    };
    return responseJson(await this.#context.fetch(request), path);
  }
}

export async function stories(client: LobstersClient, path: string, limit: number) {
  const body = await client.get(path);
  if (!Array.isArray(body)) throw new Error(`lobsters listing is malformed: ${path}`);
  return body.slice(0, limit).map((item, index) => storyRow(item, index + 1));
}

export function htmlToText(value: unknown): string {
  return text(value)
    .replace(/<p>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function indent(value: string, depth: number): string {
  return depth
    ? value
        .split('\n')
        .map(line => `${'  '.repeat(depth)}> ${line}`)
        .join('\n')
    : value;
}
