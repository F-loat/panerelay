import { createHash } from 'node:crypto';
import type { SiteCommandContext } from '@panerelay/site-kit';

type Args = Record<string, unknown>;
type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}
function text(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
function clean(value: unknown): string {
  return text(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`tieba ${name} is required`);
  return result;
}
function limit(value: unknown): number {
  const parsed = value == null || value === '' ? 20 : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 20;
  return Math.min(parsed, 20);
}
function page(value: unknown): number {
  const parsed = value == null || value === '' ? 1 : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100)
    throw new Error('tieba page must be between 1 and 100');
  return parsed;
}

async function fetchText(context: SiteCommandContext, url: string): Promise<string> {
  const response = await context.fetch({
    url,
    headers: { accept: 'text/html' },
    responseType: 'text',
    withCookies: true,
  });
  if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
    throw new Error(`tieba page failed: HTTP ${response.status}`);
  return String(response.body);
}

export async function hot(context: SiteCommandContext, args: Args) {
  const take = limit(args.limit);
  const html = await fetchText(
    context,
    'https://tieba.baidu.com/hottopic/browse/topicList?res_type=1',
  );
  const blocks = [
    ...html.matchAll(/<li[^>]+class=["'][^"']*topic-top-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi),
  ];
  return blocks
    .slice(0, take)
    .map((match, index) => {
      const block = match[1] ?? '';
      const anchor =
        block.match(
          /<a[^>]+class=["'][^"']*topic-text[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
        ) ??
        block.match(
          /<a[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*topic-text[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
        );
      const href = text(anchor?.[1]);
      return {
        rank: index + 1,
        title: clean(anchor?.[2]),
        discussions: clean(
          block.match(
            /<span[^>]+class=["'][^"']*topic-num[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
          )?.[1],
        ),
        description: clean(
          block.match(
            /<p[^>]+class=["'][^"']*topic-top-item-desc[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
          )?.[1],
        ),
        url: href ? new URL(href, 'https://tieba.baidu.com').toString() : '',
      };
    })
    .filter(row => row.title);
}

function component(feed: JsonObject, name: string): JsonObject {
  const components = Array.isArray(feed.components) ? feed.components : [];
  return object(object(components.map(object).find(entry => text(entry.component) === name))[name]);
}

function sign(params: Record<string, string>): string {
  const base = Object.keys(params)
    .sort((a, b) => a.localeCompare(b))
    .map(key => `${key}=${params[key]}`)
    .join('');
  return createHash('md5').update(`${base}36770b1f34c9bbf2e7d1a99d2b82fa9e`).digest('hex');
}

export async function posts(context: SiteCommandContext, args: Args) {
  const forum = required(args.forum, 'forum');
  const pageNumber = page(args.page);
  const take = limit(args.limit);
  const params = {
    kw: encodeURIComponent(forum),
    pn: String(pageNumber),
    sort_type: '-1',
    is_newfrs: '1',
    is_newfeed: '1',
    rn: '30',
    rn_need: String(Math.min(Math.max(take + 10, 10), 30)),
    tbs: '',
    subapp_type: 'pc',
    _client_type: '20',
  };
  const body = new URLSearchParams({ ...params, sign: sign(params) }).toString();
  const referer = `https://tieba.baidu.com/f?kw=${encodeURIComponent(forum)}&ie=utf-8&pn=${(pageNumber - 1) * 50}`;
  const response = await context.fetch({
    url: 'https://tieba.baidu.com/c/f/frs/page_pc',
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      referer,
    },
    body: { encoding: 'utf8', data: body },
    responseType: 'json',
    withCookies: true,
  });
  if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
    throw new Error(`tieba forum request failed: HTTP ${response.status}`);
  const envelope = object(response.body);
  if (Number(envelope.error_code ?? 0) !== 0)
    throw new Error(text(envelope.error_msg) || `tieba API error ${envelope.error_code}`);
  const feeds = object(envelope.page_data).feed_list;
  return (Array.isArray(feeds) ? feeds : [])
    .map(object)
    .filter(entry => text(entry.layout) === 'feed')
    .map(entry => {
      const feed = object(entry.feed);
      const titleData = component(feed, 'feed_title').data;
      const title =
        text(
          object(Array.isArray(titleData) ? titleData[0] : {}).text_info &&
            object(object(Array.isArray(titleData) ? titleData[0] : {}).text_info).text,
        ) || text(object(feed.business_info_map).title);
      const headData = component(feed, 'feed_head').main_data;
      const author = text(object(object(Array.isArray(headData) ? headData[0] : {}).text).text);
      const social = component(feed, 'feed_social');
      const id =
        text(object(feed.business_info_map).thread_id) ||
        text(
          (Array.isArray(feed.log_param) ? feed.log_param : [])
            .map(object)
            .find(item => text(item.key) === 'tid')?.value,
        );
      return {
        title,
        author,
        replies: Number(social.comment_num ?? object(feed.business_info_map).comment_num ?? 0),
        id,
        url: id ? `https://tieba.baidu.com/p/${id}` : '',
      };
    })
    .filter(row => row.title)
    .slice(0, take)
    .map((row, index) => ({ rank: index + 1, ...row }));
}
