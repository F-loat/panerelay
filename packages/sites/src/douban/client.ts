import type { SiteCommandContext } from '@panerelay/site-kit';

export type JsonObject = Record<string, unknown>;

export function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function clean(value: unknown): string {
  return text(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`douban ${name} is required`);
  return result;
}

export function subjectId(value: unknown): string {
  const id = required(value, 'id');
  if (!/^\d+$/.test(id)) throw new Error('douban id must be numeric');
  return id;
}

export function bounded(
  value: unknown,
  fallback: number,
  maximum: number,
  allowZero = false,
): number {
  const parsed = value == null || value === '' ? fallback : Number(value);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`douban limit must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function blocked(html: string): boolean {
  return /sec\.douban\.com|异常请求|登录跳转|captcha|captcha_image/i.test(html.slice(0, 20_000));
}

export class DoubanClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async html(url: string): Promise<string> {
    const response = await this.#context.fetch({
      url,
      headers: { accept: 'text/html,application/xhtml+xml', referer: 'https://www.douban.com/' },
      responseType: 'text',
      withCookies: true,
    });
    if (response.status === 401 || response.status === 403)
      throw new Error('douban requires a valid browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text') {
      throw new Error(`douban request failed: HTTP ${response.status}`);
    }
    const html = String(response.body);
    if (blocked(html)) throw new Error('douban returned a login or anti-bot page');
    return html;
  }

  async base64(url: string, referer: string): Promise<string> {
    const response = await this.#context.fetch({
      url,
      headers: { accept: 'image/avif,image/webp,image/*,*/*;q=0.8', referer },
      responseType: 'base64',
      withCookies: true,
    });
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'base64') {
      throw new Error(`douban image download failed: HTTP ${response.status}`);
    }
    return String(response.body);
  }
}

export function imageUrl(value: unknown): string {
  const raw = text(value);
  if (!/^https?:\/\//i.test(raw)) return '';
  return raw.replace(/\/view\/photo\/[^/]+\/public\//, '/view/photo/l/public/');
}
