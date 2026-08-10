import { SiteError, type SiteCommandContext } from '@panerelay/site-kit';
import {
  BASE,
  bounded,
  decodeEntities,
  OnePointThreeAcresClient,
  parseThreadBlocks,
  parseThreadList,
  positiveInteger,
  required,
  stripHtml,
  text,
  truncate,
} from './client.js';

type Args = Record<string, unknown>;

export async function guide(context: SiteCommandContext, args: Args, view: string) {
  const take = bounded(args.limit, 20, 50, 'limit');
  const items = parseThreadList(
    await new OnePointThreeAcresClient(context).html(`forum.php?mod=guide&view=${view}`),
  );
  if (!items.length) throw new SiteError('shape-drift', '1point3acres guide returned no threads');
  return items.slice(0, take).map((item, index) => ({
    rank: index + 1,
    tid: item.tid,
    title: item.title,
    forum: item.forum,
    author: item.author,
    replies: item.replies,
    views: item.views,
    ...(view === 'new' ? { postTime: item.postTime } : { lastReplyTime: item.lastReplyTime }),
    url: item.url,
  }));
}

export async function forums(context: SiteCommandContext, args: Args) {
  const html = await new OnePointThreeAcresClient(context).html('forum.php');
  const seen = new Map<string, string>();
  for (const match of html.matchAll(
    /<a href="forum-(\d+)-1\.html"[^>]*class="[^"]*overflow-hidden[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/g,
  )) {
    const fid = match[1] ?? '';
    const name = decodeEntities(match[2])
      .replace(/^\[(.+)]$/, '$1')
      .trim();
    if (fid && name && !seen.has(fid)) seen.set(fid, name);
  }
  const filter = text(args.filter).toLowerCase();
  const rows = [...seen].flatMap(([fid, name]) =>
    filter && !name.toLowerCase().includes(filter)
      ? []
      : [{ fid, name, url: `${BASE}/forum-${fid}-1.html` }],
  );
  if (!rows.length) throw new SiteError('empty-result', '1point3acres returned no matching forums');
  return rows;
}

export async function forum(context: SiteCommandContext, args: Args) {
  const fid = required(args.fid, 'fid');
  if (!/^\d+$/.test(fid)) {
    throw new SiteError('invalid-input', '1point3acres fid must be a numeric forum ID');
  }
  const page = positiveInteger(args.page, 1, 'page');
  const take = bounded(args.limit, 20, 50, 'limit');
  const html = await new OnePointThreeAcresClient(context).html(`forum-${fid}-${page}.html`);
  if (!parseThreadBlocks(html).length) {
    throw new SiteError('empty-result', `1point3acres forum ${fid} returned no threads`);
  }
  return parseThreadList(html)
    .slice(0, take)
    .map((item, index) => ({
      rank: index + 1,
      tid: item.tid,
      kind: item.kind === 'stickthread' ? '置顶' : '普通',
      title: item.title,
      author: item.author,
      replies: item.replies,
      views: item.views,
      lastReplyTime: item.lastReplyTime,
      url: item.url,
    }));
}

function extract(source: string, pattern: RegExp, group = 1): string {
  return source.match(pattern)?.[group] ?? '';
}

export async function thread(context: SiteCommandContext, args: Args) {
  const tid = required(args.tid, 'tid');
  if (!/^\d+$/.test(tid)) {
    throw new SiteError('invalid-input', '1point3acres tid must be a numeric thread ID');
  }
  const page = positiveInteger(args.page, 1, 'page');
  const take = bounded(args.limit, 10, 50, 'limit');
  const contentLimit = positiveInteger(args['content-limit'], 400, 'content-limit', 50);
  if (contentLimit > 4_000) {
    throw new SiteError('invalid-input', '1point3acres content-limit must not exceed 4000');
  }
  const html = await new OnePointThreeAcresClient(context).html(`thread-${tid}-${page}-1.html`);
  if (!/id="postlist"/.test(html) && !/id="post_\d+"/.test(html)) {
    throw new SiteError('empty-result', `1point3acres thread ${tid} was not found`);
  }
  const offsets = [...html.matchAll(/<div id="post_(\d+)"[^>]*>/g)].map(match => ({
    postId: match[1] ?? '',
    offset: match.index,
  }));
  const rows = [];
  for (let index = 0; index < offsets.length && rows.length < take; index += 1) {
    const current = offsets[index];
    if (!current) continue;
    const block = html.slice(current.offset, offsets[index + 1]?.offset ?? html.length);
    const authi = block.match(/<div class="authi"[\s\S]*?<\/div>/)?.[0] ?? '';
    const authorPatterns = [
      /<a [^>]*class="[^"]*\bxi2\b[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/,
      /<a [^>]*href="space-uid-\d+\.html"[^>]*>\s*([^<]+?)\s*<\/a>/,
      /<a [^>]*class="[^"]*\bxw1\b[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/,
    ];
    const author = authorPatterns
      .map(pattern => decodeEntities(extract(authi || block, pattern)))
      .find(value => value && !/匿名卡|变色卡|关贴卡/.test(value));
    const postTime =
      extract(authi, /<span title="([^"]+)">/) ||
      extract(block, /id="authorposton\d+"[^>]*>\s*<span title="([^"]+)">/) ||
      extract(block, /id="authorposton\d+"[^>]*>\s*([^<]+?)\s*</) ||
      extract(block, /<meta itemprop="datePublished" content="([^"]+)"/);
    const floorText =
      extract(block, /<em>(\d+)<\/em>\s*#?\s*<\/a>/) ||
      extract(block, /id="postnum\d+"[^>]*>\s*<em>(\d+)<\/em>/);
    const floor = floorText
      ? Number(floorText)
      : page === 1 && index === 0
        ? 1
        : (page - 1) * 10 + index + 1;
    const content = truncate(
      stripHtml(block.match(/id="postmessage_\d+"[^>]*>([\s\S]*?)<\/td>/)?.[1]),
      contentLimit,
    );
    rows.push({
      floor,
      pid: current.postId,
      author: author ?? '',
      postTime: postTime.trim(),
      content,
      url: `${BASE}/forum.php?mod=redirect&goto=findpost&ptid=${tid}&pid=${current.postId}`,
    });
  }
  if (!rows.length) {
    throw new SiteError('empty-result', `1point3acres thread ${tid} page ${page} has no posts`);
  }
  if (page === 1) {
    const title = decodeEntities(
      extract(html, /<span id="thread_subject">([^<]+)<\/span>/) ||
        extract(html, /<title>([^<]+?)\s*[-|]/),
    );
    const first = rows[0];
    if (first && title) first.content = `【${title}】\n${first.content}`;
  }
  return rows;
}

export async function user(context: SiteCommandContext, args: Args) {
  const who = required(args.who, 'who');
  const path = /^\d+$/.test(who)
    ? `space-uid-${who}.html`
    : `space-username-${encodeURIComponent(who)}.html`;
  const html = await new OnePointThreeAcresClient(context).html(path);
  if (/<title>提示信息/.test(html) && /(没有找到|不存在)/.test(html)) {
    throw new SiteError('empty-result', `1point3acres user ${who} was not found`);
  }
  const pick = (pattern: RegExp) => decodeEntities(extract(html, pattern));
  const pickListItem = (label: string) =>
    pick(new RegExp(`<li>\\s*${label}[：:\\s]*(?:<[^>]+>)?\\s*([^<]+?)\\s*(?:<|$)`));
  const username =
    pick(/<p class="mtm[^"]*"[^>]*>\s*<a [^>]*>([^<]+?)<\/a>/) || pick(/<title>([^<]+?)的个人资料/);
  const uid = pick(/uid=(\d+)/) || pick(/space-uid-(\d+)\.html/);
  if (!username && !uid) {
    throw new SiteError('shape-drift', '1point3acres user page has an unexpected shape');
  }
  return [
    {
      uid,
      username,
      group: pickListItem('用户组'),
      credits: pickListItem('积分'),
      rice: pickListItem('大米'),
      posts: pickListItem('帖子数'),
      threads: pickListItem('主题数'),
      digests: pickListItem('精华数'),
      registerTime: pickListItem('注册时间'),
      lastAccess: pickListItem('最后访问'),
      profileUrl: uid ? `${BASE}/space-uid-${uid}.html` : `${BASE}/${path}`,
    },
  ];
}

export async function notifications(context: SiteCommandContext, args: Args) {
  const kind = text(args.kind) || 'mypost';
  if (!['mypost', 'interactive', 'system', 'app'].includes(kind)) {
    throw new SiteError('invalid-input', '1point3acres notification kind is invalid');
  }
  const take = bounded(args.limit, 20, 100, 'limit');
  const html = await new OnePointThreeAcresClient(context).html(
    `home.php?mod=space&do=notice&view=${kind}`,
  );
  if (/<title>提示信息/.test(html) && /请登录|无法进行此操作/.test(html)) {
    throw new SiteError('auth-required', 'Sign in to 1point3acres in the selected browser');
  }
  if (/暂时没有提醒内容/.test(html)) {
    throw new SiteError('empty-result', '1point3acres has no notifications');
  }
  const rows = [];
  for (const match of html.matchAll(/<dl class="[^"]*cl[^"]*"[^>]*>([\s\S]*?)<\/dl>/g)) {
    const block = match[1] ?? '';
    const from = stripHtml(block.match(/<dt>([\s\S]*?)<\/dt>/)?.[1]);
    const summarySource =
      block.match(/<dd class="ntc_body">([\s\S]*?)<\/dd>/)?.[1] ??
      block.match(/<dd>([\s\S]*?)<\/dd>/)?.[1] ??
      '';
    const summary = truncate(stripHtml(summarySource), 200);
    const time = stripHtml(block.match(/<dd class="[^"]*xg1[^"]*"[^>]*>([\s\S]*?)<\/dd>/)?.[1]);
    const link = summarySource.match(/href="([^"]*thread-\d+[^"]*)"/)?.[1] ?? '';
    if (!from && !summary) continue;
    rows.push({
      index: rows.length + 1,
      from,
      summary,
      time,
      threadUrl: !link ? '' : link.startsWith('http') ? link : `${BASE}/${link}`,
    });
    if (rows.length >= take) break;
  }
  if (!rows.length) {
    throw new SiteError('empty-result', '1point3acres returned no readable notifications');
  }
  return rows;
}
