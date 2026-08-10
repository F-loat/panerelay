import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://www.autohome.com.cn';
export const KOUBEI_BASE = 'https://k.autohome.com.cn';
export const BRAND_INITIAL: Record<string, string> = {
  宝马: 'B',
  奔驰: 'B',
  比亚迪: 'B',
  本田: 'B',
  大众: 'D',
  丰田: 'F',
  吉利: 'J',
  理想: 'L',
  蔚来: 'W',
  小鹏: 'X',
  小米: 'X',
  特斯拉: 'T',
};
export function required(value: unknown, label: string): string {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`autohome ${label} is required`);
  return result;
}
export function bounded(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`autohome limit must be an integer between 1 and ${maximum}`);
  return result;
}
export function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
export function resolveInitial(value: unknown): string {
  const raw = required(value, 'brand');
  if (/^[a-z]$/i.test(raw)) return raw.toUpperCase();
  const initial = BRAND_INITIAL[raw.replace(/[·\s]/g, '')];
  if (!initial) throw new Error(`autohome brand "${raw}" is not recognised`);
  return initial;
}
export function seriesId(value: unknown): string {
  const raw = required(value, 'series id');
  const match = raw.match(/\/(?:s)?(\d+)(?:\/|$|\.)/) ?? raw.match(/^s?(\d+)$/);
  if (!match) throw new Error(`autohome series id "${raw}" is not valid`);
  return match[1]!;
}
export function pageProps(html: string): Record<string, unknown> | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]!);
    return data?.props?.pageProps ?? null;
  } catch {
    return null;
  }
}
export class AutohomeClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async text(url: string): Promise<string> {
    const request: BrowserFetchRequest = { url, responseType: 'text', withCookies: false };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new Error(`autohome request failed: HTTP ${response.status}`);
    return String(response.body ?? '');
  }
}
