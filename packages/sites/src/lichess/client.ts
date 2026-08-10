import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://lichess.org';
const PERFS = [
  'ultraBullet',
  'bullet',
  'blitz',
  'rapid',
  'classical',
  'chess960',
  'crazyhouse',
  'antichess',
  'atomic',
  'horde',
  'kingOfTheHill',
  'racingKings',
  'threeCheck',
];
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function username(value: unknown): string {
  const result = text(value);
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(result))
    throw new Error('lichess username must be 2-30 letters, digits, underscore, or dash');
  return result;
}
export function perf(value: unknown): string {
  const result = text(value);
  if (!PERFS.includes(result)) throw new Error(`lichess perf must be one of: ${PERFS.join(', ')}`);
  return result;
}
export function bounded(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum)
    throw new Error(`lichess limit must be an integer between 1 and ${maximum}`);
  return result;
}
export function timestamp(value: unknown): string | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? new Date(number).toISOString() : null;
}

export class LichessClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async get(path: string): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      headers: { accept: 'application/json', 'user-agent': 'Panerelay Lichess adapter' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`lichess resource not found: ${path}`);
    if (response.status === 429) throw new Error('lichess returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`lichess request failed: HTTP ${response.status}`);
    return response.body;
  }
}
