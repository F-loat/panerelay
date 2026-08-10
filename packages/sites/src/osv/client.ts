import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://api.osv.dev';
type Value = Record<string, unknown>;
const ecosystems = new Set([
  'npm',
  'PyPI',
  'Go',
  'Maven',
  'NuGet',
  'RubyGems',
  'crates.io',
  'Packagist',
  'Pub',
  'Hex',
  'Hackage',
  'CRAN',
  'Bitnami',
  'GitHub Actions',
  'SwiftURL',
]);

export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`osv ${label} cannot be empty`);
  return result;
}
export function ecosystem(value: unknown): string {
  const result = required(value, 'ecosystem');
  if (!ecosystems.has(result)) throw new Error(`osv ecosystem "${value}" is not recognised`);
  return result;
}
export function vulnId(value: unknown): string {
  const result = required(value, 'vulnerability id');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(result))
    throw new Error(`osv vulnerability id "${value}" is not valid`);
  return result;
}
export function boundedLimit(value: unknown, fallback: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 200)
    throw new Error('osv limit must be an integer between 1 and 200');
  return result;
}
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function trimDate(value: unknown): string | null {
  const result = text(value);
  if (!result) return null;
  const normalized = result.replace(/\.\d+/, '');
  return normalized.endsWith('Z') ? normalized : result.slice(0, 10);
}
export function severity(value: unknown): string | null {
  const direct = text(pick(pick(value, 'database_specific'), 'severity'));
  if (direct) return direct;
  const entries = pick(value, 'severity');
  if (!Array.isArray(entries)) return null;
  const score = entries.find(entry => text(pick(entry, 'score')));
  return score ? text(pick(score, 'score')) : null;
}
export function affectedPackages(value: unknown): string {
  const affected = pick(value, 'affected');
  if (!Array.isArray(affected)) return '';
  return affected
    .map(
      item =>
        `${text(pick(pick(item, 'package'), 'ecosystem'))}:${text(pick(pick(item, 'package'), 'name'))}`,
    )
    .filter(item => !item.startsWith(':') && !item.endsWith(':'))
    .join(', ');
}
export function aliases(value: unknown): string {
  const list = pick(value, 'aliases');
  return Array.isArray(list) ? list.filter(Boolean).join(', ') : '';
}

export class OsvClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(path: string, method: 'GET' | 'POST', body?: Value): Promise<Value> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      method,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? { encoding: 'utf8', data: JSON.stringify(body) } : undefined,
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`osv resource not found: ${path}`);
    if (response.status === 429) throw new Error('osv returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`osv request failed: HTTP ${response.status}`);
    return response.body as Value;
  }
}
