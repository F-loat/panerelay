import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function cveId(value: unknown): string {
  const result = text(value).toUpperCase();
  if (!/^CVE-\d{4}-\d{4,}$/.test(result)) throw new Error(`nvd CVE id "${value}" is not valid`);
  return result;
}
export function englishDescription(value: unknown): string {
  if (!Array.isArray(value)) return '';
  const row = value.find(item => text(pick(item, 'lang')) === 'en') ?? value[0];
  return text(pick(row, 'value'));
}
export function primaryCvss(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2']) {
    const rows = pick(value, key);
    if (Array.isArray(rows)) {
      const primary = rows.find(row => text(pick(row, 'type')) === 'Primary');
      if (primary) return primary;
      if (rows[0]) return rows[0];
    }
  }
  return null;
}
export function cwes(value: unknown): string {
  if (!Array.isArray(value)) return '';
  const ids = new Set<string>();
  for (const weakness of value) {
    const descriptions = pick(weakness, 'description');
    if (Array.isArray(descriptions))
      for (const description of descriptions) {
        const id = text(pick(description, 'value'));
        if (id) ids.add(id);
      }
  }
  return [...ids].join(', ');
}
export class NvdClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(query: Record<string, string>): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: BASE,
      query: Object.entries(query).map(([name, value]) => ({ name, value })),
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error('nvd CVE not found');
    if (response.status === 403 || response.status === 429)
      throw new Error(`nvd returned HTTP ${response.status} (rate limited)`);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`nvd request failed: HTTP ${response.status}`);
    return response.body;
  }
}
