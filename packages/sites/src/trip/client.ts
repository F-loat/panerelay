import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function object(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Value) : {};
}
export function text(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
export function keyword(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`trip ${name} cannot be empty`);
  return result;
}
export function limit(value: unknown): number {
  const result = value == null || value === '' ? 20 : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 50)
    throw new Error('trip limit must be an integer between 1 and 50');
  return result;
}
export function isoDate(value: unknown, name: string): string {
  const result = text(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result);
  if (!match) throw new Error(`trip ${name} must use YYYY-MM-DD`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== result)
    throw new Error(`trip ${name} is not a real calendar date`);
  return result;
}

export class TripClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async post(url: string, body: unknown): Promise<Value> {
    const request: BrowserFetchRequest = {
      url,
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', currency: 'USD' },
      body: { encoding: 'utf8', data: JSON.stringify(body) },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`trip request failed: HTTP ${response.status}`);
    return object(response.body);
  }
  async poi(query: string): Promise<Value[]> {
    const body = await this.post('https://www.trip.com/restapi/soa2/14427/poiSearch', {
      key: query,
      mode: '0',
      tripType: 'RT',
      Head: {
        Currency: 'USD',
        Locale: 'en-US',
        Source: 'ONLINE',
        Channel: 'EnglishSite',
        ClientID: 'panerelay-trip',
      },
    });
    const results = pick(body, 'results');
    if (!Array.isArray(results)) throw new Error('trip POI search returned an unexpected payload');
    return results.filter(item => item && typeof item === 'object') as Value[];
  }
}

export function destination(item: Value, rank: number): Value {
  const airportCode = text(pick(item, 'airportCode'));
  const cityId = Number(pick(item, 'cityId'));
  return {
    rank,
    name: text(pick(item, 'name')) || null,
    type: airportCode ? 'airport' : 'city',
    cityId: Number.isFinite(cityId) && cityId !== 0 ? cityId : null,
    airportCode: airportCode || null,
    province: text(pick(item, 'provinceName')) || null,
    country: text(pick(item, 'countryName')) || null,
  };
}

export async function resolveCity(client: TripClient, query: string): Promise<Value | null> {
  for (const item of await client.poi(query)) {
    if (pick(item, 'airportCode')) continue;
    const cityCode = text(pick(item, 'cityCode')).toUpperCase();
    const cityId = Number(pick(item, 'cityId'));
    if (cityCode && Number.isFinite(cityId) && cityId !== 0)
      return { name: text(pick(item, 'name')) || query, cityCode, cityId };
  }
  return null;
}
