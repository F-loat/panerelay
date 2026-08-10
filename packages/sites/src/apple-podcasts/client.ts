import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const ITUNES_BASE = 'https://itunes.apple.com';
export const CHARTS_BASE = 'https://rss.marketingtools.apple.com/api/v2';

export function required(value: unknown, label: string): string {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`apple-podcasts ${label} is required`);
  return result;
}

export function limit(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`apple-podcasts limit must be an integer between 1 and ${maximum}`);
  return result;
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function formatDuration(value: unknown): string {
  const milliseconds = Number(value);
  if (!milliseconds || !Number.isFinite(milliseconds)) return '-';
  const seconds = Math.round(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatDate(value: unknown): string {
  const result = text(value);
  return result ? result.slice(0, 10) : '-';
}

export class ApplePodcastsClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async json(
    url: string,
    query: Array<{ name: string; value: string | number }> = [],
  ): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url,
      query: query.map(item => ({ name: item.name, value: String(item.value) })),
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`apple-podcasts request failed: HTTP ${response.status}`);
    return response.body;
  }
}
