import { SiteError, type BrowserFetchRequest, type SiteCommandContext } from '@panerelay/site-kit';

export type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function object(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Value) : {};
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function token(value: unknown): string {
  const result = text(value);
  if (!result) throw new SiteError('invalid-input', 'paperreview token cannot be empty');
  return result;
}
export function timeout(value: unknown): number {
  const seconds = value == null || value === '' ? 30 : Number(value);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 120)
    throw new SiteError(
      'invalid-input',
      'paperreview timeout must be an integer between 1 and 120 seconds',
    );
  return seconds * 1000;
}
export function reviewUrl(value: string): string {
  return `https://paperreview.ai/review?token=${encodeURIComponent(value)}`;
}

export class PaperReviewClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(
    path: string,
    method: 'GET' | 'POST',
    timeoutMs: number,
    payload?: unknown,
  ): Promise<{ status: number; body: unknown }> {
    const request: BrowserFetchRequest = {
      url: `https://paperreview.ai${path}`,
      method,
      headers: {
        accept: 'application/json',
        ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(payload === undefined
        ? {}
        : { body: { encoding: 'utf8' as const, data: JSON.stringify(payload) } }),
      responseType: 'json',
      withCookies: false,
      timeoutMs,
    };
    const response = await this.#context.fetch(request);
    if (response.bodyType !== 'json')
      throw new SiteError(
        'shape-drift',
        `paperreview returned a non-JSON response (HTTP ${response.status})`,
      );
    if (response.status < 200 || response.status >= 300) {
      const body = object(response.body);
      if (response.status === 404)
        throw new SiteError('empty-result', 'PaperReview review was not found');
      if (response.status === 429 || response.status >= 500)
        throw new SiteError(
          'upstream-failure',
          `PaperReview request failed with HTTP ${response.status}`,
          response.status === 429 || response.status >= 500,
        );
      throw new SiteError(
        'command-failed',
        text(pick(body, 'detail') || pick(body, 'message') || pick(body, 'error')) ||
          `PaperReview request failed with HTTP ${response.status}`,
      );
    }
    return { status: response.status, body: response.body };
  }
}
