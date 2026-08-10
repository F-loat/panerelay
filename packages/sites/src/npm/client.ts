import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const NPM_REGISTRY = 'https://registry.npmjs.org';
export const NPM_API = 'https://api.npmjs.org';
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;

export function requireString(value: unknown, label: string): string {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`npm ${label} cannot be empty`);
  return result;
}
export function requirePackageName(value: unknown): string {
  const result = String(value ?? '').trim();
  if (!result) throw new Error('npm package name is required');
  if (result.length > 214 || !PACKAGE_NAME.test(result))
    throw new Error(`npm package name "${value}" is not a valid registry name`);
  return result;
}
export function boundedInteger(
  value: unknown,
  fallback: number,
  maximum: number,
  label: string,
): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`npm ${label} must be an integer between 1 and ${maximum}`);
  return result;
}
export function text(value: unknown): string {
  return String(value ?? '');
}
export function number(value: unknown): number | null {
  return value == null ? null : Number(value);
}

export class NpmClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(url: string, query: Record<string, string | number> = {}): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url,
      query: Object.entries(query).map(([name, value]) => ({ name, value: String(value) })),
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`npm resource not found: ${url}`);
    if (response.status === 429) throw new Error('npm request returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`npm request failed: HTTP ${response.status}`);
    return response.body;
  }
}
