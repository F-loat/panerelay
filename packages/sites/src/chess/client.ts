import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
type Value = Record<string, unknown>;
export const BASE = 'https://api.chess.com/pub';
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function user(value: unknown): string {
  const result = text(value).toLowerCase();
  if (!/^[a-z0-9_-]{3,25}$/.test(result))
    throw new Error('chess username must be 3-25 letters, digits, underscore, or dash');
  return result;
}
export function gameUrl(value: unknown): { kind: 'live' | 'daily'; id: string } {
  const result = text(value);
  const match = result.match(/^https:\/\/www\.chess\.com\/game\/(live|daily)\/(\d+)/i);
  const kind = match?.[1];
  const id = match?.[2];
  if (!kind || !id)
    throw new Error(
      'chess game URL must be https://www.chess.com/game/live/<id> or /game/daily/<id>',
    );
  return { kind: kind.toLowerCase() as 'live' | 'daily', id };
}
export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`chess limit must be an integer between 1 and ${maximum}`);
  return result;
}
export function date(value: unknown): string {
  const result = Number(value);
  return Number.isFinite(result) && result > 0
    ? new Date(result * 1000).toISOString().slice(0, 10)
    : '';
}
export function scalar(value: unknown): string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : '';
}
export class ChessClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async get(path: string): Promise<Value> {
    const request: BrowserFetchRequest = {
      url: path.startsWith('http') ? path : `${BASE}${path}`,
      headers: { accept: 'application/json', 'user-agent': 'Panerelay Chess adapter' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`chess resource not found: ${path}`);
    if (
      response.status < 200 ||
      response.status >= 300 ||
      response.bodyType !== 'json' ||
      !response.body ||
      typeof response.body !== 'object' ||
      Array.isArray(response.body)
    )
      throw new Error(`chess request failed: HTTP ${response.status}`);
    return response.body as Value;
  }
}
