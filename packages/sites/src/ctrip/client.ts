import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
export function required(value: unknown): string {
  const result = text(value);
  if (!result) throw new Error('ctrip query cannot be empty');
  return result;
}
export function limit(value: unknown): number {
  const result = value == null || value === '' ? 15 : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 50)
    throw new Error('ctrip limit must be an integer between 1 and 50');
  return result;
}
export class CtripClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async suggest(query: string, searchType: 'D' | 'H'): Promise<Value[]> {
    const request: BrowserFetchRequest = {
      url: 'https://m.ctrip.com/restapi/soa2/21881/json/gaHotelSearchEngine',
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: {
        encoding: 'utf8',
        data: JSON.stringify({
          keyword: query,
          searchType,
          platform: 'online',
          pageID: '102001',
          head: {
            Locale: 'zh-CN',
            LocaleController: 'zh_cn',
            Currency: 'CNY',
            PageId: '102001',
            clientID: 'panerelay-ctrip',
            group: 'ctrip',
            Frontend: { sessionID: 1, pvid: 1 },
            HotelExtension: { group: 'CTRIP', WebpSupport: false },
          },
        }),
      },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`ctrip suggest failed: HTTP ${response.status}`);
    const body = response.body;
    if (pick(body, 'Result') === false)
      throw new Error(`ctrip suggest returned ErrorCode=${String(pick(body, 'ErrorCode'))}`);
    const rows = pick(pick(body, 'Response'), 'searchResults');
    if (!Array.isArray(rows) || !rows.length)
      throw new Error(`ctrip returned no suggestions for "${query}"`);
    return rows.filter(row => row && typeof row === 'object') as Value[];
  }
}
function coordinate(item: Value, first: string, second: string, fallback: string): number | null {
  for (const key of [first, second, fallback]) {
    const value = Number(pick(item, key));
    if (Number.isFinite(value) && value !== 0) return value;
  }
  return null;
}
export function row(item: Value, rank: number): Value {
  const id = text(pick(item, 'id'));
  const type = text(pick(item, 'type'));
  const cityId = Number(pick(item, 'cityId')) || null;
  const cityName = text(pick(item, 'cityName'));
  let url = '';
  if (type === 'City' && cityId)
    url = `https://you.ctrip.com/place/${encodeURIComponent(cityName)}${cityId}.html`;
  else if (type === 'Hotel' && id) url = `https://hotels.ctrip.com/hotels/detail/?hotelid=${id}`;
  else if ((type === 'BusinessArea' || type === 'Zone') && cityId && id)
    url = `https://hotels.ctrip.com/hotels/list?city=${cityId}&zone=${id}`;
  else if (type === 'Markland' && id && cityId)
    url = `https://you.ctrip.com/sight/${encodeURIComponent(cityName)}${cityId}/${id}.html`;
  else if (type === 'RailwayStation' && id)
    url = `https://trains.ctrip.com/trainstation/${id}.html`;
  return {
    rank,
    id: id || null,
    type: type || null,
    displayType: text(pick(item, 'displayType')) || null,
    name: text(pick(item, 'displayName') || pick(item, 'word') || pick(item, 'cityName')) || null,
    eName: text(pick(item, 'eName')) || null,
    cityId,
    cityName: cityName || null,
    provinceName: text(pick(item, 'provinceName')) || null,
    countryName: text(pick(item, 'countryName')) || null,
    lat: coordinate(item, 'gdLat', 'gLat', 'lat'),
    lon: coordinate(item, 'gdLon', 'gLon', 'lon'),
    score: Number(pick(item, 'commentScore') || pick(item, 'cStar')) || null,
    url,
  };
}
