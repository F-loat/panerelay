import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const STATION_BUNDLE_URL =
  'https://kyfw.12306.cn/otn/resources/js/framework/station_name.js';
export const INIT_URL = 'https://kyfw.12306.cn/otn/leftTicket/init';
export const API_ORIGIN = 'https://kyfw.12306.cn';
export const TRAIN_NO_RE = /^[0-9A-Za-z]{8,18}$/;
export const QUERY_ENDPOINT_RE = /^query[A-Z]$/;
export type RailAdapterArgs = Record<string, string | number | boolean>;
export type Station = {
  short: string;
  name: string;
  code: string;
  pinyin: string;
  abbr: string;
  city: string;
};
export type TrainRow = {
  train_no: string;
  code: string;
  from_station: string;
  to_station: string;
  from_code: string;
  to_code: string;
  start_time: string;
  arrive_time: string;
  duration: string;
  available: boolean;
  business_seat: string;
  first_seat: string;
  second_seat: string;
  soft_sleeper: string;
  hard_sleeper: string;
  hard_seat: string;
  no_seat: string;
};

export function requiredString(args: RailAdapterArgs, name: string): string {
  const value = String(args[name] ?? '').trim();
  if (!value) throw new Error(`12306 ${name} is required`);
  return value;
}

export function positiveInteger(
  value: unknown,
  label: string,
  fallback: number,
  maximum: number,
): number {
  const selected = value == null || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  }
  return selected;
}

export function parseStationBundle(text: string): Station[] {
  const raw = text.match(/'([^']+)'/)?.[1];
  if (!raw) throw new Error('12306 station bundle is malformed');
  const stations = raw
    .split('@')
    .filter(Boolean)
    .flatMap(record => {
      const parts = record.split('|');
      if (parts.length < 8 || !parts[2]) return [];
      return [
        {
          short: parts[0] ?? '',
          name: parts[1] ?? '',
          code: parts[2] ?? '',
          pinyin: parts[3] ?? '',
          abbr: parts[4] ?? '',
          city: parts[7] ?? '',
        },
      ];
    });
  if (!stations.length) throw new Error('12306 station bundle contains no stations');
  return stations;
}

export function matchStations(stations: Station[], keyword: string, limit: number): Station[] {
  const lower = keyword.toLowerCase();
  return stations
    .filter(
      station =>
        station.name.includes(keyword) ||
        station.code === keyword.toUpperCase() ||
        station.pinyin.includes(lower) ||
        station.abbr.includes(lower) ||
        station.short.includes(lower) ||
        station.city.includes(keyword),
    )
    .slice(0, limit);
}

export function resolveStation(stations: Station[], input: string): Station {
  const value = input.trim();
  const upper = value.toUpperCase();
  const exact = stations.find(
    station =>
      station.name === value ||
      station.pinyin === value.toLowerCase() ||
      station.abbr === value.toLowerCase() ||
      station.short === value.toLowerCase() ||
      station.code === upper,
  );
  if (!exact) throw new Error(`Unknown 12306 station "${input}"`);
  return exact;
}

export function validateDate(value: unknown): string {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
    throw new Error(`12306 date must be YYYY-MM-DD, got "${text}"`);
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day
  )
    throw new Error(`12306 date "${text}" is invalid`);
  return text;
}

export function buildCookieHeader(values: string[]): string {
  return values
    .map(value => value.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

export function extractQueryEndpoint(value: unknown): string {
  const raw = String(value ?? '')
    .trim()
    .replace(/^leftTicket\//, '');
  if (QUERY_ENDPOINT_RE.test(raw)) return raw;
  try {
    const url = new URL(raw, API_ORIGIN);
    if (url.hostname !== 'kyfw.12306.cn') return '';
    return url.pathname.match(/\/leftTicket\/(query[A-Z])$/)?.[1] ?? '';
  } catch {
    return '';
  }
}

export function parseTrainRecord(
  line: string,
  stationByCode: Map<string, Station>,
): TrainRow | undefined {
  const fields = line.split('|');
  if (fields.length < 33) return undefined;
  return {
    train_no: fields[2] ?? '',
    code: fields[3] ?? '',
    from_station: stationByCode.get(fields[6] ?? '')?.name ?? fields[6] ?? '',
    to_station: stationByCode.get(fields[7] ?? '')?.name ?? fields[7] ?? '',
    from_code: fields[6] ?? '',
    to_code: fields[7] ?? '',
    start_time: fields[8] ?? '',
    arrive_time: fields[9] ?? '',
    duration: fields[10] ?? '',
    available: (fields[1] ?? '').trim() === '预订' || (fields[11] ?? '').trim() === 'Y',
    business_seat: fields[32] ?? '',
    first_seat: fields[31] ?? '',
    second_seat: fields[30] ?? '',
    soft_sleeper: fields[23] ?? '',
    hard_sleeper: fields[28] ?? '',
    hard_seat: fields[29] ?? '',
    no_seat: fields[26] ?? '',
  };
}

export function maskEmail(value: unknown): string {
  const text = String(value ?? '').trim();
  const at = text.indexOf('@');
  if (!text || at <= 0) return text;
  const local = text.slice(0, at);
  return `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local.slice(-1)}${text.slice(at)}`;
}

export function maskMobile(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text || text.includes('*') || text.length < 7) return text;
  return `${text.slice(0, 3)}${'*'.repeat(text.length - 7)}${text.slice(-4)}`;
}

export function maskChineseName(value: unknown): string {
  const text = String(value ?? '').trim();
  if (text.length <= 1) return text;
  if (text.length === 2) return `${text[0]}*`;
  return `${text[0]}${'*'.repeat(text.length - 2)}${text.slice(-1)}`;
}

export function isAuthLikePayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Record<string, unknown>;
  const messages = [
    value.message,
    value.msg,
    ...(Array.isArray(value.messages) ? value.messages : []),
  ];
  return /未登录|登录|请登录|身份|认证|session|login/i.test(messages.map(String).join(' '));
}

export class ChinaRailClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async stationBundle(): Promise<Station[]> {
    const request: BrowserFetchRequest = {
      url: STATION_BUNDLE_URL,
      responseType: 'text',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300)
      throw new Error(`12306 station bundle returned HTTP ${response.status}`);
    if (response.bodyType !== 'text') throw new Error('12306 station bundle is not text');
    return parseStationBundle(String(response.body));
  }

  async request(request: BrowserFetchRequest, label: string): Promise<unknown> {
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300)
      throw new Error(`12306 ${label} returned HTTP ${response.status}`);
    if (response.bodyType !== 'json') throw new Error(`12306 ${label} response is not JSON`);
    return response.body;
  }

  async authenticatedJson(
    url: string,
    label: string,
    method: 'GET' | 'POST' = 'GET',
    body?: string,
  ): Promise<Record<string, unknown>> {
    const value = await this.request(
      {
        url,
        method,
        headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
        body: body ? { encoding: 'utf8', data: body } : undefined,
        withCookies: true,
        responseType: 'json',
      },
      label,
    );
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error(`12306 ${label} returned a malformed payload`);
    const payload = value as Record<string, unknown>;
    if (isAuthLikePayload(payload) || payload.status === false)
      throw new Error(`12306 ${label} requires a valid login session`);
    return payload;
  }

  async mintSession(): Promise<string> {
    const response = await this.#context.fetch({
      url: INIT_URL,
      responseType: 'text',
      withCookies: true,
    });
    if (response.status < 200 || response.status >= 300)
      throw new Error(`12306 init returned HTTP ${response.status}`);
    return '';
  }

  async query(path: string, query: Record<string, string>, cookie: string): Promise<unknown> {
    return this.request(
      {
        url: `${API_ORIGIN}${path}`,
        query: Object.entries(query).map(([name, value]) => ({ name, value })),
        ...(cookie ? { headers: { Cookie: cookie } } : {}),
        responseType: 'json',
        withCookies: true,
      },
      path,
    );
  }

  async queryRotating(
    paths: string[],
    query: Record<string, string>,
    cookie: string,
  ): Promise<Record<string, unknown>> {
    let lastError: unknown;
    const queue = [...paths];
    const tried = new Set<string>();
    while (queue.length) {
      const path = queue.shift()!;
      if (tried.has(path)) continue;
      tried.add(path);
      try {
        const response = await this.query(path, query, cookie);
        if (response && typeof response === 'object') {
          const payload = response as Record<string, unknown>;
          const data = payload.data as Record<string, unknown> | undefined;
          if (Array.isArray(data?.result) && data.result.length > 0) return payload;
          if (payload.status === true && data) return payload;
          const rotated = extractQueryEndpoint(payload.c_url);
          if (rotated && !tried.has(rotated)) {
            queue.unshift(`/otn/leftTicket/${rotated}`);
            continue;
          }
        }
        lastError = new Error(`12306 ${path} returned no usable data`);
      } catch (error) {
        lastError = error;
      }
    }
    throw (
      lastError ?? new Error(`12306 rejected every known query endpoint name (${paths.join(', ')})`)
    );
  }
}
