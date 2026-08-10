import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

const BASE_URL = 'https://www.guazi.com';
const CITY_CODES: Record<string, string> = {
  beijing: 'bj',
  北京: 'bj',
  shanghai: 'sh',
  上海: 'sh',
  guangzhou: 'gz',
  广州: 'gz',
  shenzhen: 'sz',
  深圳: 'sz',
  hangzhou: 'hz',
  杭州: 'hz',
  chengdu: 'cd',
  成都: 'cd',
  chongqing: 'cq',
  重庆: 'cq',
  nanjing: 'nj',
  南京: 'nj',
  wuhan: 'wh',
  武汉: 'wh',
  tianjin: 'tj',
  天津: 'tj',
  xian: 'xa',
  西安: 'xa',
  suzhou: 'su',
  苏州: 'su',
  zhengzhou: 'zz',
  郑州: 'zz',
  changsha: 'cs',
  长沙: 'cs',
  qingdao: 'qd',
  青岛: 'qd',
  shenyang: 'sy',
  沈阳: 'sy',
  dalian: 'dl',
  大连: 'dl',
  jinan: 'jn',
  济南: 'jn',
  hefei: 'hf',
  合肥: 'hf',
  foshan: 'fs',
  佛山: 'fs',
};

export function text(value: unknown): string {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cityCode(value: unknown): string {
  if (value == null || value === '') return 'bj';
  const original = text(value);
  const normalized = original.toLowerCase();
  const result = CITY_CODES[normalized] ?? CITY_CODES[original];
  if (result) return result;
  if (/^[a-z]{2,3}$/.test(normalized)) return normalized;
  throw new Error(`guazi city "${original}" is unknown; pass a city name or Guazi city code`);
}

export function clueId(value: unknown): string {
  const input = text(value);
  const match = input.match(/car-detail\/c(\d+)/) ?? input.match(/^c?(\d+)$/);
  if (!match?.[1]) throw new Error(`guazi clue-id "${input}" is invalid`);
  return match[1];
}

export function limit(value: unknown, fallback: number, maximum: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum) {
    throw new Error(`guazi limit must be an integer between 1 and ${maximum}`);
  }
  return result;
}

export function pageUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export class GuaziClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async html(path: string): Promise<string> {
    const request: BrowserFetchRequest = {
      url: pageUrl(path),
      method: 'GET',
      headers: { accept: 'text/html,application/xhtml+xml', 'accept-language': 'zh-CN,zh;q=0.9' },
      responseType: 'text',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text') {
      throw new Error(`guazi request failed: HTTP ${response.status}`);
    }
    const html = String(response.body ?? '');
    if (
      /瑞数|reese84|captcha|滑动验证|verify\.guazi|安全验证/i.test(html) &&
      !/car-detail\/c\d+/.test(html)
    ) {
      throw new Error('guazi returned an anti-bot challenge instead of the public mobile page');
    }
    return html;
  }
}
