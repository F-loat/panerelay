import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';
type Value = Record<string, unknown>;
export const CATEGORIES = [
  '__all__',
  'news_tech',
  'news_finance',
  'news_world',
  'news_sports',
  'news_entertainment',
  'news_military',
];
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function limit(value: unknown, fallback: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 50)
    throw new Error('toutiao limit must be an integer between 1 and 50');
  return result;
}
export class ToutiaoClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async get(url: string): Promise<Value> {
    const request: BrowserFetchRequest = {
      url,
      headers: { accept: 'application/json', referer: 'https://www.toutiao.com/' },
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
      throw new Error(`toutiao request failed: HTTP ${response.status}`);
    return response.body as Value;
  }
}
function image(item: Value): string {
  const direct = text(
    pick(pick(item, 'Image'), 'url') ||
      pick(item, 'image_url') ||
      pick(pick(item, 'middle_image'), 'url'),
  );
  if (direct) return direct.startsWith('//') ? `https:${direct}` : direct;
  const list = pick(pick(item, 'Image'), 'url_list');
  if (!Array.isArray(list)) return '';
  return text(pick(list[0], 'url') || list[0]);
}
export function hotRow(item: Value, rank: number): Value | null {
  const title = text(pick(item, 'Title'));
  if (!title) return null;
  const group = text(pick(item, 'ClusterIdStr') || pick(item, 'ClusterId'));
  return {
    rank,
    group_id: group,
    title,
    query: text(pick(item, 'QueryWord')) || title,
    hot_value: Number(pick(item, 'HotValue')) || 0,
    label: text(pick(item, 'Label')),
    url: text(pick(item, 'Url')),
    image_url: image(item),
  };
}
export function recommendRow(item: Value, rank: number): Value | null {
  if (pick(item, 'is_feed_ad')) return null;
  const title = text(pick(item, 'title'));
  if (!title) return null;
  const sourceUrl = text(pick(item, 'source_url'));
  const pathId = sourceUrl.match(/^\/(?:group|article)\/([A-Za-z0-9_-]+)/)?.[1] || '';
  const group = text(pick(item, 'group_id')) || pathId;
  if (!/^[A-Za-z0-9_-]+$/.test(group)) return null;
  const seconds = Number(pick(item, 'behot_time'));
  return {
    rank,
    group_id: group,
    title,
    abstract: text(pick(item, 'abstract')),
    source: text(pick(item, 'source')),
    tag: text(pick(item, 'chinese_tag')),
    comments: Number(pick(item, 'comments_count')) || 0,
    published_at:
      Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : '',
    url: `https://www.toutiao.com/group/${group}/`,
    image_url: image(item),
  };
}
