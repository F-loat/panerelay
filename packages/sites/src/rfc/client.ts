import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://datatracker.ietf.org';

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`rfc ${label} cannot be empty`);
  return result;
}

export function rfcNumber(value: unknown): number {
  const raw = text(value);
  const normalized = raw.toLowerCase().replace(/^rfc/, '');
  const result = Number(normalized);
  if (!/^[1-9]\d*$/.test(normalized) || !Number.isInteger(result) || result > 999999)
    throw new Error(`rfc number "${value}" is not valid`);
  return result;
}

export function date(value: unknown): string | null {
  const result = text(value);
  return /^\d{4}-\d{2}-\d{2}/.test(result) ? result.slice(0, 10) : null;
}

export class RfcClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(number: number): Promise<unknown> {
    const name = `rfc${number}`;
    const request: BrowserFetchRequest = {
      url: `${BASE}/doc/${name}/doc.json`,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`rfc ${number} not found`);
    if (response.status === 429) throw new Error('rfc returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`rfc request failed: HTTP ${response.status}`);
    return response.body;
  }
}
