import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://wttr.in';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`wttr ${label} cannot be empty`);
  return result;
}

export function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function weatherDescription(value: unknown): string {
  if (!Array.isArray(value) || !value.length) return '';
  return text(pick(value[0], 'value'));
}

export class WttrClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(location: string): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}/${encodeURIComponent(location)}`,
      query: [{ name: 'format', value: 'j1' }],
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`wttr location not found: ${location}`);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`wttr request failed: HTTP ${response.status}`);
    return response.body;
  }
}
