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
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`hupu ${name} is required`);
  return result;
}
function bounded(value: unknown, fallback: number, maximum: number): number {
  const parsed = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum)
    throw new Error(`hupu value must be between 1 and ${maximum}`);
  return parsed;
}
function count(value: unknown): number {
  const raw = text(value);
  const match = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*(万)?/);
  return match ? Math.round(Number(match[1]) * (match[2] ? 10_000 : 1)) : 0;
}

async function fetchBody(context: SiteCommandContext, url: string, type: 'text' | 'json' = 'text') {
  const response = await context.fetch({
    url,
    headers: {
      accept: type === 'json' ? 'application/json' : 'text/html',
      referer: 'https://bbs.hupu.com/',
    },
    responseType: type,
    withCookies: true,
  });
  if (response.status === 401 || response.status === 403)
    throw new Error('hupu requires a valid logged-in browser session');
  if (response.status < 200 || response.status >= 300 || response.bodyType !== type)
    throw new Error(`hupu request failed: HTTP ${response.status}`);
  return response.body;
}

function scriptJson(html: string, id: string): JsonObject {
  const source = html.match(
    new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i'),
  )?.[1];
  if (!source) return {};
  try {
    return object(JSON.parse(source));
  } catch {
    return {};
  }
}

function assignedJson(html: string, marker: string): JsonObject {
  const start = html.indexOf(marker);
  if (start < 0) return {};
  const source = html.slice(start + marker.length);
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let begin = -1;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (char === '{') {
      if (begin < 0) begin = index;
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
      if (begin >= 0 && depth === 0) {
        try {
          return object(JSON.parse(source.slice(begin, index + 1)));
        } catch {
          return {};
        }
      }
    }
  }
  return {};
}

export async function detail(context: SiteCommandContext, args: Args) {
  const tid = required(args.tid, 'tid');
  if (!/^\d{9}$/.test(tid)) throw new Error('hupu tid must be a 9-digit thread ID');
  const data = scriptJson(
    String(await fetchBody(context, `https://bbs.hupu.com/${tid}.html`)),
    '__NEXT_DATA__',
  );
  const pageProps = object(object(data.props).pageProps);
  const error = object(pageProps.detail_error_info);
  if (Object.keys(error).length && Number(error.code) !== 200)
    throw new Error(text(error.message) || `hupu detail error ${error.code}`);
  const detailData = object(pageProps.detail);
  const thread = object(detailData.thread);
  if (!text(thread.title)) throw new Error('hupu thread was not present in the HTTP response');
  let content = clean(thread.content);
  if (content.length > 300) content = `${content.slice(0, 300)}...`;
  if (args.replies === true || text(args.replies) === 'true') {
    const lights = Array.isArray(detailData.lights)
      ? detailData.lights.slice(0, 3).map(object)
      : [];
    const rendered = lights
      .map(
        (reply, index) =>
          `${index + 1}. ${text(object(reply.author).puname) || '未知用户'} (亮${Number(reply.allLightCount ?? 0)} ${text(reply.created_at_format)}): ${clean(reply.content).slice(0, 100)}`,
      )
      .join('\n');
    if (rendered) content += `\n\n【热门回复】\n${rendered}`;
  }
  return [
    {
      title: text(thread.title),
      author: text(object(thread.author).puname) || '未知作者',
      content,
      replies: Number(thread.replies ?? 0),
      lights: Number(thread.lights ?? 0),
      url: `https://bbs.hupu.com/${tid}.html`,
    },
  ];
}

export async function search(context: SiteCommandContext, args: Args) {
  const query = required(args.query, 'query');
  const page = bounded(args.page, 1, 100);
  const take = bounded(args.limit, 20, 100);
  const sort = text(args.sort) || 'general';
  if (!['general', 'createtime', 'replytime', 'light', 'reply'].includes(sort))
    throw new Error('hupu sort is invalid');
  const url = new URL('https://bbs.hupu.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('sortby', sort);
  if (text(args.forum)) url.searchParams.set('topicId', text(args.forum));
  const html = String(await fetchBody(context, url.toString()));
  const data = assignedJson(html, 'window.$$data=');
  const rows = object(data.searchRes).data;
  return (Array.isArray(rows) ? rows : []).slice(0, take).map((raw, index) => {
    const item = object(raw);
    const tid = text(item.id);
    return {
      rank: index + 1,
      tid,
      title: clean(item.title),
      author: text(item.username) || '未知用户',
      replies: Number(item.replies ?? 0),
      lights: Number(item.lights ?? 0),
      forum: text(item.forum_name) || '未知板块',
      url: tid ? `https://bbs.hupu.com/${tid}.html` : '',
    };
  });
}

export async function hot(context: SiteCommandContext, args: Args) {
  const take = bounded(args.limit, 20, 100);
  const html = String(await fetchBody(context, 'https://bbs.hupu.com/'));
  const matches = [
    ...html.matchAll(
      /<div[^>]+class=["'][^"']*t-info[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*t-info|<\/main>|$)/gi,
    ),
  ];
  const rows = [];
  for (const match of matches) {
    const block = match[1] ?? '';
    const anchor = block.match(/<a[^>]+href=["']\/(\d{9})\.html["'][^>]*>([\s\S]*?)<\/a>/i);
    const tid = text(anchor?.[1]);
    const title = clean(anchor?.[2]);
    if (!tid || !title) continue;
    rows.push({
      rank: rows.length + 1,
      tid,
      title,
      lights: count(
        block.match(/<[^>]+class=["'][^"']*t-lights[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
      ),
      replies: count(
        block.match(/<[^>]+class=["'][^"']*t-replies[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
      ),
      forum: clean(block.match(/<[^>]+class=["'][^"']*t-label[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1]),
      is_hot: /<a[^>]+class=["'][^"']*\bhot\b/i.test(block),
      url: `https://bbs.hupu.com/${tid}.html`,
    });
    if (rows.length >= take) break;
  }
  return rows;
}

export async function mentions(context: SiteCommandContext, args: Args) {
  const take = bounded(args.limit, 20, 100);
  const maxPages = bounded(args['max-pages'] ?? args.max_pages, 3, 10);
  let cursor = text(args['page-str'] ?? args.page_str);
  const items: JsonObject[] = [];
  let hasNext = false;
  let next = cursor;
  for (let index = 0; index < maxPages && items.length < take; index += 1) {
    const url = new URL('https://my.hupu.com/pcmapi/pc/space/v1/getMentionedRemindList');
    url.searchParams.set('plate', '1');
    if (cursor) url.searchParams.set('pageStr', cursor);
    const api = object(await fetchBody(context, url.toString(), 'json'));
    if (Number(api.code ?? 0) > 1)
      throw new Error(text(api.msg ?? api.message) || `hupu API error ${api.code}`);
    const data = object(api.data);
    const pageItems = Array.isArray(data.hisList) ? data.hisList.map(object) : [];
    items.push(...pageItems);
    hasNext = Boolean(data.hasNextPage);
    next = text(data.pageStr);
    if (!hasNext || !next || next === cursor) break;
    cursor = next;
  }
  return items.slice(0, take).map(item => {
    const tid = text(item.tid);
    const pid = text(item.pid);
    return {
      time: text(item.publishTime),
      username: text(item.username),
      thread_title: text(item.threadTitle),
      tid,
      pid,
      post_content: clean(item.postContent),
      quote_content: clean(item.quoteContent),
      url: tid ? `https://bbs.hupu.com/${tid}.html` : '',
      reply_url: tid && pid ? `https://bbs.hupu.com/${tid}.html?pid=${pid}` : '',
      topic_id: text(item.topicId),
      msg_type: item.msgType ?? '',
      has_next_page: hasNext,
      next_page_str: next,
    };
  });
}

export async function whoami(context: SiteCommandContext) {
  const html = String(await fetchBody(context, 'https://my.hupu.com/'));
  const match =
    html.match(/<a[^>]+href=["'][^"']*\/people\/([^/"']+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ??
    html.match(/<a[^>]+href=["'][^"']*\/user\/([^/"']+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const userId = text(match?.[1]);
  if (!userId) throw new Error('hupu requires a valid logged-in browser session');
  return [{ logged_in: true, site: 'hupu', user_id: userId, username: clean(match?.[2]) }];
}
