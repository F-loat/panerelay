import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://developer.mozilla.org';
const LOCALES = ['en-US', 'de', 'es', 'fr', 'ja', 'ko', 'pt-BR', 'ru', 'zh-CN', 'zh-TW'];
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function limit(value: unknown): number {
  const result = value == null || value === '' ? 10 : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 50)
    throw new Error('mdn limit must be an integer between 1 and 50');
  return result;
}
export function locale(value: unknown): string {
  const result = text(value || 'en-US');
  if (!LOCALES.includes(result))
    throw new Error(`mdn locale must be one of: ${LOCALES.join(', ')}`);
  return result;
}
export class MdnClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async search(query: string, size: number, language: string): Promise<Record<string, unknown>> {
    const request: BrowserFetchRequest = {
      url: `${BASE}/api/v1/search?q=${encodeURIComponent(query)}&locale=${encodeURIComponent(language)}&size=${size}`,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 429) throw new Error('mdn search returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`mdn search failed: HTTP ${response.status}`);
    if (!response.body || typeof response.body !== 'object' || Array.isArray(response.body))
      throw new Error('mdn search returned malformed JSON');
    return response.body as Record<string, unknown>;
  }
}
