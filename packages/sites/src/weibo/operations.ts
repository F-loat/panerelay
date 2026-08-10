import type { SiteCommandContext } from '@panerelay/site-kit';
import {
  bounded,
  clean,
  object,
  pick,
  postRow,
  profileRow,
  required,
  text,
  type Value,
  WeiboClient,
} from './client.js';
type Args = Record<string, unknown>;
export async function comments(context: SiteCommandContext, args: Args) {
  const take = bounded(args.limit, 20, 50);
  const id = required(args.id, 'id');
  const data = await new WeiboClient(context).get(
    `/ajax/statuses/buildComments?flow=0&is_reload=1&id=${encodeURIComponent(id)}&is_show_bulletin=2&is_mix=0&count=${take}`,
  );
  const rows = pick(data, 'data');
  return (Array.isArray(rows) ? rows : []).slice(0, take).map((raw, i) => {
    const item = object(raw);
    return {
      rank: i + 1,
      author: text(pick(pick(item, 'user'), 'screen_name')),
      text: clean(pick(item, 'text')),
      likes: pick(item, 'like_count') ?? 0,
      replies: pick(item, 'total_number') ?? 0,
      time: text(pick(item, 'created_at')),
    };
  });
}
export async function hot(context: SiteCommandContext, args: Args) {
  const take = bounded(args.limit, 30, 50);
  const list = pick(
    pick(await new WeiboClient(context).get('/ajax/statuses/hot_band'), 'data'),
    'band_list',
  );
  return (Array.isArray(list) ? list : []).slice(0, take).map((raw, i) => {
    const item = object(raw);
    const word = text(pick(item, 'word'));
    return {
      rank: pick(item, 'realpos') ?? i + 1,
      word,
      hot_value: pick(item, 'num') ?? 0,
      category: text(pick(item, 'category')),
      label: text(pick(item, 'label_name')),
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(`#${word}#`)}`,
    };
  });
}
export async function user(context: SiteCommandContext, args: Args) {
  const client = new WeiboClient(context);
  const id = required(args.id, 'id');
  const query = /^\d+$/.test(id) ? `uid=${id}` : `screen_name=${encodeURIComponent(id)}`;
  const info = await client.get(`/ajax/profile/info?${query}`);
  const data = object(pick(info, 'data'));
  const account = object(pick(data, 'user'));
  if (!text(pick(account, 'id'))) throw new Error('weibo user not found');
  const detail = object(
    pick(await client.get(`/ajax/profile/detail?uid=${text(pick(account, 'id'))}`), 'data'),
  );
  return [profileRow(account, detail)];
}
export async function me(context: SiteCommandContext) {
  const client = new WeiboClient(context);
  const rows = await user(context, { id: await client.selfUid() });
  const row = object(rows[0]);
  return [
    {
      screen_name: pick(row, 'screen_name'),
      uid: pick(row, 'uid'),
      followers: pick(row, 'followers'),
      following: pick(row, 'following'),
      statuses: pick(row, 'statuses'),
      verified: pick(row, 'verified'),
      location: pick(row, 'location'),
    },
  ];
}
export async function whoami(context: SiteCommandContext) {
  const client = new WeiboClient(context);
  const uid = await client.selfUid();
  const rows = await user(context, { id: uid });
  const row = object(rows[0]);
  return [
    {
      logged_in: true,
      site: 'weibo',
      user_id: uid,
      screen_name: pick(row, 'screen_name'),
      profile_url: pick(row, 'url'),
    },
  ];
}
export async function feed(context: SiteCommandContext, args: Args) {
  const client = new WeiboClient(context);
  const uid = await client.selfUid();
  const type = text(args.type) || 'for-you';
  if (!['for-you', 'following'].includes(type))
    throw new Error('weibo type must be for-you or following');
  const take = bounded(args.limit, 15, 50);
  const endpoint = type === 'following' ? 'friendstimeline' : 'unreadfriendstimeline';
  const data = await client.get(
    `/ajax/feed/${endpoint}?list_id=10001${uid}&refresh=4&since_id=0&count=${take}`,
  );
  const statuses = pick(data, 'statuses');
  return (Array.isArray(statuses) ? statuses : []).slice(0, take).map(raw => postRow(object(raw)));
}
export async function post(context: SiteCommandContext, args: Args) {
  const client = new WeiboClient(context);
  const data = await client.get(
    `/ajax/statuses/show?id=${encodeURIComponent(required(args.id, 'id'))}`,
  );
  let fullText = text(pick(data, 'text_raw')) || clean(pick(data, 'text'));
  if (pick(data, 'isLongText') || pick(data, 'is_long_text')) {
    try {
      const long = await client.get(`/ajax/statuses/longtext?id=${text(pick(data, 'idstr'))}`);
      fullText = clean(pick(pick(long, 'data'), 'longTextContent')) || fullText;
    } catch {
      // Keep the preview text when the optional long-text endpoint is unavailable.
    }
  }
  const row = {
    ...postRow(data),
    text: fullText,
    created_at: pick(data, 'created_at'),
    source: clean(pick(data, 'source')),
  };
  return Object.entries(row).map(([field, value]) => ({ field, value: String(value ?? '') }));
}
export async function userPosts(context: SiteCommandContext, args: Args) {
  const client = new WeiboClient(context);
  const rawId = required(args.id, 'id');
  const take = bounded(args.limit, 20, 100);
  let uid = rawId;
  if (!/^\d+$/.test(uid)) {
    const profile = object(
      pick(await client.get(`/ajax/profile/info?screen_name=${encodeURIComponent(uid)}`), 'data'),
    );
    uid = text(pick(pick(profile, 'user'), 'id'));
    if (!uid) throw new Error('weibo user not found');
  }
  const start = text(args.start);
  const end = text(args.end);
  for (const [name, value] of [
    ['start', start],
    ['end', end],
  ])
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Error(`weibo ${name} must use YYYY-MM-DD`);
  const starttime = start ? Math.floor(new Date(`${start}T00:00:00+08:00`).getTime() / 1000) : null;
  const endtime = end
    ? Math.floor(new Date(`${end}T00:00:00+08:00`).getTime() / 1000) + 86399
    : null;
  if (starttime != null && endtime != null && starttime > endtime)
    throw new Error('weibo start must be before end');
  const rows: Value[] = [];
  for (let page = 1; page <= 20 && rows.length < take; page++) {
    const params = new URLSearchParams({
      uid,
      page: String(page),
      hasori: '1',
      hasret:
        args['include-retweets'] === true || text(args['include-retweets']) === 'true' ? '1' : '0',
    });
    if (starttime != null) params.set('starttime', String(starttime));
    if (endtime != null) params.set('endtime', String(endtime));
    const list = pick(
      pick(await client.get(`/ajax/statuses/searchProfile?${params}`), 'data'),
      'list',
    );
    if (!Array.isArray(list) || !list.length) break;
    for (const raw of list) {
      const row = postRow(object(raw), rows.length + 1);
      if (text(pick(row, 'id')) && text(pick(row, 'mblogid')) && text(pick(row, 'text')))
        rows.push(row);
      if (rows.length >= take) break;
    }
    if (list.length < 10) break;
  }
  return rows;
}
function normalizedPostId(value: unknown): string {
  let id = required(value, 'id');
  try {
    const url = new URL(id);
    if (!/(^|\.)weibo\.(com|cn)$/i.test(url.hostname))
      throw new Error('weibo delete URL host is invalid');
    const parts = url.pathname.split('/').filter(Boolean);
    id =
      url.hostname.endsWith('weibo.cn') && parts[0] === 'status'
        ? (parts[1] ?? '')
        : (parts.at(-1) ?? '');
  } catch (error) {
    if (error instanceof Error && error.message.includes('host')) throw error;
  }
  if (!/^[A-Za-z0-9]{4,32}$/.test(id)) throw new Error('weibo delete id is invalid');
  return id;
}
export async function remove(context: SiteCommandContext, args: Args) {
  const client = new WeiboClient(context);
  const input = normalizedPostId(args.id);
  const status = await client.get(`/ajax/statuses/show?id=${encodeURIComponent(input)}`);
  const id = text(pick(status, 'idstr'));
  const mblogid = text(pick(status, 'mblogid'));
  if (!id) throw new Error('weibo post not found');

  await client.post('/ajax/statuses/destroy', { id });
  const verify = await client.probe(`/ajax/statuses/show?id=${encodeURIComponent(id)}`);
  if (verify.status === 401 || verify.status === 403) {
    throw new Error('weibo could not verify deletion because the session is no longer authorized');
  }
  if (verify.status === 404) return [{ status: 'deleted', id, mblogid }];
  if (verify.status < 200 || verify.status >= 300 || verify.bodyType !== 'json') {
    throw new Error(`weibo could not verify deletion: HTTP ${verify.status}`);
  }

  const verified = object(verify.body);
  if (text(pick(verified, 'idstr')) === id) {
    throw new Error('weibo delete API returned success but the post still exists');
  }
  if (pick(verified, 'ok') === 0 || !text(pick(verified, 'idstr'))) {
    return [{ status: 'deleted', id, mblogid }];
  }
  throw new Error('weibo delete verification returned an unexpected post');
}
function htmlText(value: string): string {
  return clean(value);
}
export async function search(context: SiteCommandContext, args: Args) {
  const client = new WeiboClient(context);
  const keyword = required(args.keyword, 'keyword');
  const take = bounded(args.limit, 10, 50);
  const html = await client.html(`/weibo?q=${encodeURIComponent(keyword)}`);
  const chunks = [
    ...html.matchAll(
      /<div[^>]+class=["'][^"']*card-wrap[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*card-wrap|<\/main>)/gi,
    ),
  ];
  const rows = [];
  for (const match of chunks) {
    const chunk = match[1] ?? '';
    const content = htmlText(
      chunk.match(
        /<[^>]+(?:node-type=["']feed_list_content(?:_full)?["']|class=["'][^"']*txt[^"']*["'])[^>]*>([\s\S]*?)<\//i,
      )?.[1] ?? '',
    );
    if (!content) continue;
    const author = htmlText(
      chunk.match(/<[^>]+class=["'][^"']*name[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] ?? '',
    );
    const from = chunk.match(
      /<[^>]+class=["'][^"']*from[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    const url = from?.[1] ? new URL(from[1], 'https://s.weibo.com').toString() : '';
    const id = url.match(/(?:weibo\.com\/(?:\d+\/|detail\/|status\/))([A-Za-z0-9]+)/)?.[1] ?? '';
    rows.push({
      rank: rows.length + 1,
      id,
      title: content,
      author,
      time: htmlText(from?.[2] ?? ''),
      url,
    });
    if (rows.length >= take) break;
  }
  return rows;
}
