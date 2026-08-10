import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export type Value = Record<string, unknown>;
export function object(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Value) : {};
}
export function pick(value: unknown, key: string): unknown {
  return object(value)[key];
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`boss ${name} is required`);
  return result;
}
export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`boss value must be an integer between 1 and ${maximum}`);
  return result;
}
export function array(value: unknown, label: string): Value[] {
  if (!Array.isArray(value)) throw new Error(`boss ${label} response is malformed`);
  return value.map(object);
}

export class BossClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(
    url: string,
    options: { body?: URLSearchParams; allowNonZero?: boolean } = {},
  ): Promise<Value> {
    const request: BrowserFetchRequest = {
      url,
      ...(options.body
        ? {
            method: 'POST' as const,
            headers: {
              accept: 'application/json',
              'content-type': 'application/x-www-form-urlencoded',
              referer: 'https://www.zhipin.com/web/chat/index',
            },
            body: { encoding: 'utf8' as const, data: options.body.toString() },
          }
        : {
            headers: {
              accept: 'application/json',
              referer: 'https://www.zhipin.com/web/chat/index',
            },
          }),
      responseType: 'json',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 401 || response.status === 403)
      throw new Error('boss requires a valid logged-in browser session');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`boss request failed: HTTP ${response.status}`);
    const payload = object(response.body);
    const code = Number(pick(payload, 'code'));
    if (!options.allowNonZero && code !== 0) {
      const message = text(pick(payload, 'message')) || 'unknown error';
      if ([7, 37].includes(code)) throw new Error(`boss login cookies expired: ${message}`);
      if (code === 24) throw new Error('boss command requires a recruiter-side account');
      throw new Error(`boss API failed: ${message} (code=${code})`);
    }
    return payload;
  }
  async friendList(page = 1, jobId = '0'): Promise<Value[]> {
    const payload = await this.request(
      `https://www.zhipin.com/wapi/zprelation/friend/getBossFriendListV2.json?page=${page}&status=0&jobId=${encodeURIComponent(jobId)}`,
    );
    return array(pick(pick(payload, 'zpData'), 'friendList'), 'friend list');
  }
  async recommends(): Promise<Value[]> {
    const payload = await this.request(
      'https://www.zhipin.com/wapi/zprelation/friend/greetRecSortList',
    );
    return array(pick(pick(payload, 'zpData'), 'friendList'), 'recommendations');
  }
  async friend(uid: string): Promise<Value | undefined> {
    const direct = (await this.friendList()).find(item => text(pick(item, 'encryptUid')) === uid);
    if (direct) return direct;
    return (await this.recommends()).find(item => text(pick(item, 'encryptUid')) === uid);
  }
}

const CITY_CODES: Record<string, string> = {
  全国: '100010000',
  北京: '101010100',
  上海: '101020100',
  广州: '101280100',
  深圳: '101280600',
  杭州: '101210100',
  成都: '101270100',
  南京: '101190100',
  武汉: '101200100',
  西安: '101110100',
  苏州: '101190400',
  长沙: '101250100',
  天津: '101030100',
  重庆: '101040100',
  郑州: '101180100',
  东莞: '101281600',
  青岛: '101120200',
  合肥: '101220100',
  佛山: '101280800',
  宁波: '101210400',
  厦门: '101230200',
  大连: '101070200',
  珠海: '101280700',
  无锡: '101190200',
  济南: '101120100',
  福州: '101230100',
  昆明: '101290100',
  哈尔滨: '101050100',
  沈阳: '101070100',
  石家庄: '101090100',
  贵阳: '101260100',
  南宁: '101300100',
  太原: '101100100',
  海口: '101310100',
  兰州: '101160100',
  乌鲁木齐: '101130100',
  长春: '101060100',
  南昌: '101240100',
  常州: '101191100',
  温州: '101210700',
  嘉兴: '101210300',
  徐州: '101190800',
  香港: '101320100',
};
export const EXPERIENCE: Record<string, string> = {
  不限: '0',
  '在校/应届': '108',
  在校生: '108',
  在校: '108',
  应届生: '102',
  应届: '102',
  经验不限: '101',
  '1年以内': '103',
  '1-3年': '104',
  '3-5年': '105',
  '5-10年': '106',
  '10年以上': '107',
};
export const DEGREE: Record<string, string> = {
  不限: '0',
  初中及以下: '209',
  '中专/中技': '208',
  高中: '206',
  大专: '202',
  本科: '203',
  硕士: '204',
  博士: '205',
};
export const SALARY: Record<string, string> = {
  不限: '0',
  '3K以下': '401',
  '3-5K': '402',
  '5-10K': '403',
  '10-15K': '404',
  '15-20K': '405',
  '20-30K': '406',
  '30-50K': '407',
  '50K以上': '408',
};
export const INDUSTRY: Record<string, string> = {
  不限: '0',
  互联网: '100020',
  电子商务: '100021',
  游戏: '100024',
  人工智能: '100901',
  大数据: '100902',
  金融: '100101',
  教育培训: '100200',
  医疗健康: '100300',
};
export const JOB_TYPE: Record<string, string> = {
  不限: '0',
  全职: '1901',
  实习: '1902',
  兼职: '1903',
};

export function city(value: unknown): string {
  const input = text(value) || '北京';
  if (/^\d+$/.test(input)) return input;
  return (
    CITY_CODES[input] ??
    Object.entries(CITY_CODES).find(([name]) => name.includes(input))?.[1] ??
    '101010100'
  );
}
export function mapped(value: unknown, map: Record<string, string>): string {
  const input = text(value);
  if (!input) return '';
  return map[input] ?? Object.entries(map).find(([name]) => name.includes(input))?.[1] ?? input;
}
