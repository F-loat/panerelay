import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`eastmoney value must be an integer between 1 and ${maximum}`);
  return result;
}
export function choice(
  value: unknown,
  fallback: string,
  allowed: Record<string, unknown>,
  label: string,
): string {
  const result = text(value || fallback).toLowerCase();
  if (!(result in allowed))
    throw new Error(`eastmoney ${label} must be one of: ${Object.keys(allowed).join(', ')}`);
  return result;
}
export class EastmoneyClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(url: URL | string): Promise<Value> {
    const request: BrowserFetchRequest = {
      url: String(url),
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (
      response.status < 200 ||
      response.status >= 300 ||
      response.bodyType !== 'json' ||
      !response.body ||
      typeof response.body !== 'object' ||
      Array.isArray(response.body)
    )
      throw new Error(`eastmoney request failed: HTTP ${response.status}`);
    return response.body as Value;
  }
}
export function objectRows(value: unknown, label: string): Value[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error(`eastmoney ${label} returned no data`);
  return value.filter(row => row && typeof row === 'object') as Value[];
}
const KNOWN = new Set([
  '0',
  '1',
  '100',
  '105',
  '106',
  '107',
  '116',
  '140',
  '150',
  '151',
  '152',
  '155',
  '156',
]);
export function secid(value: unknown): string {
  const raw = text(value);
  const existing = raw.match(/^(\d{1,3})\.([A-Za-z0-9]+)$/);
  if (existing && KNOWN.has(existing[1] ?? '')) return raw;
  const lower = raw.toLowerCase();
  const pref = lower.match(/^(sh|sz|bj)(\d{6})$/);
  if (pref) return `${pref[1] === 'sh' ? '1' : '0'}.${pref[2]}`;
  const hk = lower.match(/^hk(\d{4,5})$/) || lower.match(/^(\d{4,5})\.hk$/);
  if (hk) return `116.${String(hk[1]).padStart(5, '0')}`;
  const us = lower.match(/^us\.([a-z.-]+)$/);
  if (us) return `105.${String(us[1]).toUpperCase()}`;
  const suffix = lower.match(/^([a-z.-]+)\.([no])$/);
  if (suffix) return `${suffix[2] === 'n' ? '106' : '105'}.${String(suffix[1]).toUpperCase()}`;
  if (/^\d{6}$/.test(raw)) return `${/^(60|68|90|113|900)/.test(raw) ? '1' : '0'}.${raw}`;
  if (/^[A-Z.-]{1,8}$/.test(raw)) return `105.${raw}`;
  throw new Error(`eastmoney unrecognized symbol: ${raw}`);
}
export function symbols(value: unknown): string[] {
  const rows = text(value)
    .split(/[,，\s]+/)
    .filter(Boolean);
  if (!rows.length) throw new Error('eastmoney requires at least one symbol');
  return rows;
}
export function secucode(value: unknown): string {
  const raw = text(value).toUpperCase();
  if (/^\d{6}\.(SH|SZ|BJ)$/.test(raw)) return raw;
  const pref = raw.match(/^(SH|SZ|BJ)(\d{6})$/);
  if (pref) return `${pref[2]}.${pref[1]}`;
  if (/^\d{6}$/.test(raw))
    return `${raw}.${/^(60|68|90|113|900)/.test(raw) ? 'SH' : /^(4|8|920|83|87)/.test(raw) ? 'BJ' : 'SZ'}`;
  throw new Error(`eastmoney unrecognized A-share symbol: ${raw}`);
}
export function clistUrl(params: Record<string, string>): URL {
  const url = new URL('https://push2.eastmoney.com/api/qt/clist/get');
  for (const [key, value] of Object.entries({
    pn: '1',
    np: '1',
    fltt: '2',
    invt: '2',
    ut: 'bd1d9ddb04089700cf9c27f6f7426281',
    ...params,
  }))
    url.searchParams.set(key, value);
  return url;
}
