import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const EXTRACT_MAX_LEN = 300;
export const DESC_MAX_LEN = 80;

export function language(value: unknown): string {
  const result = String(value ?? 'en')
    .trim()
    .toLowerCase();
  if (!/^[a-z]{2,3}(?:-[a-z0-9]+)?$/.test(result))
    throw new Error(`wikipedia lang must be a language code like en, zh, ja (got "${value}")`);
  return result;
}

export function boundedLimit(value: unknown, fallback = 10, maximum = 50): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`wikipedia limit must be an integer between 1 and ${maximum}`);
  return result;
}

export function title(value: unknown): string {
  const result = String(value ?? '').trim();
  if (!result) throw new Error('wikipedia title cannot be empty');
  return result;
}

export function formatSummary(
  data: Record<string, unknown>,
  lang: string,
): Record<string, unknown> {
  const urls = data.content_urls as Record<string, unknown> | undefined;
  const desktop = urls?.desktop as Record<string, unknown> | undefined;
  return {
    title: String(data.title ?? ''),
    description: typeof data.description === 'string' ? data.description : '-',
    extract: String(data.extract ?? '').slice(0, EXTRACT_MAX_LEN),
    url: typeof desktop?.page === 'string' ? desktop.page : `https://${lang}.wikipedia.org`,
  };
}

export class WikipediaClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(
    lang: string,
    path: string,
    query: Record<string, string | number> = {},
  ): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `https://${lang}.wikipedia.org${path}`,
      query: Object.entries(query).map(([name, value]) => ({ name, value: String(value) })),
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`Wikipedia API HTTP ${response.status}`);
    return response.body;
  }
}
