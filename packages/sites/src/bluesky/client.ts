import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://public.api.bsky.app/xrpc';
export type Row = Record<string, unknown>;

export function text(value: unknown): string {
  return String(value ?? '');
}

export function limit(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`bluesky limit must be an integer between 1 and ${maximum}`);
  return result;
}

export function required(value: unknown, name: string): string {
  const result = text(value).trim();
  if (!result) throw new Error(`bluesky ${name} cannot be empty`);
  return result;
}

export function pick(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const key of path.split('.')) {
    current = current && typeof current === 'object' ? (current as Row)[key] : undefined;
  }
  return current;
}

export class BlueskyClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(path: string, query: Record<string, string | number> = {}): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}/${path}`,
      query: Object.entries(query).map(([name, value]) => ({ name, value: String(value) })),
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`bluesky request failed: HTTP ${response.status}`);
    return response.body;
  }
}
