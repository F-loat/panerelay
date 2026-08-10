import type { SiteCommandContext } from '@panerelay/site-kit';
import {
  bounded,
  confirm,
  flag,
  InstagramClient,
  mediaRow,
  object,
  required,
  text,
  userRow,
  type JsonObject,
} from './client.js';
type Args = Record<string, unknown>;

export async function whoami(context: SiteCommandContext) {
  const data = await new InstagramClient(context).request(
    '/api/v1/accounts/current_user/?edit=true',
  );
  const user = object(data.user);
  const id = text(user.pk ?? user.id);
  if (!id) throw new Error('instagram current account was not present');
  return [
    {
      logged_in: true,
      site: 'instagram',
      user_id: id,
      username: text(user.username),
      full_name: text(user.full_name),
    },
  ];
}
export async function profile(context: SiteCommandContext, args: Args) {
  const user = await new InstagramClient(context).profile(required(args.username, 'username'));
  return [
    {
      username: text(user.username),
      name: text(user.full_name),
      bio: text(user.biography).replace(/\n/g, ' ').slice(0, 120),
      followers: Number(object(user.edge_followed_by).count ?? 0),
      following: Number(object(user.edge_follow).count ?? 0),
      posts: Number(object(user.edge_owner_to_timeline_media).count ?? 0),
      verified: user.is_verified ? 'Yes' : 'No',
      url: `https://www.instagram.com/${text(user.username)}`,
    },
  ];
}
export async function search(context: SiteCommandContext, args: Args) {
  const take = bounded(args.limit, 10, 50);
  const data = await new InstagramClient(context).request(
    `/web/search/topsearch/?query=${encodeURIComponent(required(args.query, 'query'))}&context=user`,
  );
  return (Array.isArray(data.users) ? data.users : [])
    .slice(0, take)
    .map((entry, index) => userRow(object(entry).user, index + 1));
}
export async function user(context: SiteCommandContext, args: Args) {
  const username = required(args.username, 'username');
  const take = bounded(args.limit, 12, 100);
  const data = await new InstagramClient(context).request(
    `/api/v1/feed/user/${encodeURIComponent(username)}/username/?count=${take}`,
  );
  return (Array.isArray(data.items) ? data.items : [])
    .slice(0, take)
    .map((entry, index) => mediaRow(entry, index + 1));
}
export async function followers(context: SiteCommandContext, args: Args) {
  const client = new InstagramClient(context);
  const take = bounded(args.limit, 20, 100);
  const account = await client.profile(required(args.username, 'username'));
  const data = await client.request(
    `/api/v1/friendships/${encodeURIComponent(text(account.id))}/followers/?count=${take}`,
  );
  return (Array.isArray(data.users) ? data.users : [])
    .slice(0, take)
    .map((entry, index) => userRow(entry, index + 1));
}
export async function following(context: SiteCommandContext, args: Args) {
  const client = new InstagramClient(context);
  const take = bounded(args.limit, 20, 200);
  const account = await client.profile(required(args.username, 'username'));
  const rows: ReturnType<typeof userRow>[] = [];
  const seen = new Set<string>();
  let cursor = '';
  for (let page = 0; page < 20 && rows.length < take; page += 1) {
    const data = await client.request(
      `/api/v1/friendships/${encodeURIComponent(text(account.id))}/following/?count=50${cursor ? `&max_id=${encodeURIComponent(cursor)}` : ''}`,
    );
    const users = Array.isArray(data.users) ? data.users.map(object) : [];
    for (const entry of users) {
      const id = text(entry.pk ?? entry.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push(userRow(entry, rows.length + 1));
      if (rows.length >= take) break;
    }
    const next = text(data.next_max_id);
    if (
      !users.length ||
      !next ||
      next === cursor ||
      (!flag(data.has_more) && data.has_more != null)
    )
      break;
    cursor = next;
  }
  return rows;
}
function collectMedia(value: unknown, rows: JsonObject[], seen: Set<string>, depth = 0): void {
  if (!value || typeof value !== 'object' || depth > 8) return;
  if (Array.isArray(value)) {
    for (const item of value) collectMedia(item, rows, seen, depth + 1);
    return;
  }
  const node = object(value);
  const media = object(node.media);
  const id = text(media.pk ?? media.id ?? media.code);
  if (id && !seen.has(id)) {
    seen.add(id);
    rows.push(media);
  }
  for (const [key, child] of Object.entries(node))
    if (key !== 'media') collectMedia(child, rows, seen, depth + 1);
}
export async function explore(context: SiteCommandContext, args: Args) {
  const take = bounded(args.limit, 20, 100);
  const data = await new InstagramClient(context).request('/api/v1/discover/web/explore_grid/');
  const medias: JsonObject[] = [];
  collectMedia(data.sectional_items, medias, new Set());
  return medias
    .slice(0, take)
    .map((entry, index) => ({ rank: index + 1, ...mediaRow(entry, index + 1) }));
}
async function collections(client: InstagramClient) {
  const data = await client.request(
    '/api/v1/collections/list/?collection_types=%5B%22MEDIA%22%2C%22ALL_MEDIA_AUTO_COLLECTION%22%5D',
  );
  return Array.isArray(data.items) ? data.items.map(object) : [];
}
export async function saved(context: SiteCommandContext, args: Args) {
  const client = new InstagramClient(context);
  const take = bounded(args.limit, 20, 100);
  let path = '/api/v1/feed/saved/posts/';
  const wanted = text(args.collection).toLowerCase();
  if (wanted) {
    const match = (await collections(client)).find(
      item => text(item.collection_name).toLowerCase() === wanted,
    );
    if (!match) throw new Error(`instagram collection not found: ${args.collection}`);
    path = `/api/v1/feed/collection/${encodeURIComponent(text(match.collection_id))}/posts/`;
  }
  const data = await client.request(path);
  return (Array.isArray(data.items) ? data.items : [])
    .slice(0, take)
    .map((entry, index) => mediaRow(object(entry).media, index + 1));
}

async function mediaAction(
  context: SiteCommandContext,
  args: Args,
  kind: 'like' | 'unlike' | 'save' | 'unsave',
) {
  confirm(args);
  const username = required(args.username, 'username');
  const index = bounded(args.index, 1, 50);
  const client = new InstagramClient(context);
  const media = await client.media(username, index);
  const pk = required(media.pk, 'media id');
  const path =
    kind === 'like' || kind === 'unlike'
      ? `/api/v1/web/likes/${pk}/${kind}/`
      : `/api/v1/web/save/${pk}/${kind}/`;
  await client.post(path);
  return [
    {
      status: kind[0]?.toUpperCase() + kind.slice(1),
      user: username,
      post: text(object(media.caption).text).slice(0, 60) || `(post #${index})`,
    },
  ];
}
export const like = (context: SiteCommandContext, args: Args) => mediaAction(context, args, 'like');
export const unlike = (context: SiteCommandContext, args: Args) =>
  mediaAction(context, args, 'unlike');
export const save = (context: SiteCommandContext, args: Args) => mediaAction(context, args, 'save');
export const unsave = (context: SiteCommandContext, args: Args) =>
  mediaAction(context, args, 'unsave');
async function relationship(
  context: SiteCommandContext,
  args: Args,
  action: 'follow' | 'unfollow',
) {
  confirm(args);
  const username = required(args.username, 'username');
  const client = new InstagramClient(context);
  const account = await client.profile(username);
  const data = await client.post(
    `/api/v1/friendships/${action === 'follow' ? 'create' : 'destroy'}/${encodeURIComponent(text(account.id))}/`,
  );
  const status =
    action === 'unfollow'
      ? 'Unfollowed'
      : object(data.friendship_status).following
        ? 'Following'
        : object(data.friendship_status).outgoing_request
          ? 'Request sent'
          : 'Followed';
  return [{ status, username }];
}
export const follow = (context: SiteCommandContext, args: Args) =>
  relationship(context, args, 'follow');
export const unfollow = (context: SiteCommandContext, args: Args) =>
  relationship(context, args, 'unfollow');
export async function comment(context: SiteCommandContext, args: Args) {
  confirm(args);
  const username = required(args.username, 'username');
  const body = required(args.text, 'text');
  if (body.length > 2200) throw new Error('instagram comment is too long');
  const client = new InstagramClient(context);
  const media = await client.media(username, bounded(args.index, 1, 50));
  await client.post(
    `/api/v1/web/comments/${encodeURIComponent(required(media.pk, 'media id'))}/add/`,
    { comment_text: body },
  );
  return [{ status: 'Commented', user: username, text: body }];
}

export async function download(context: SiteCommandContext, args: Args) {
  const input = new URL(required(args.url, 'url'));
  if (!/(^|\.)instagram\.com$/i.test(input.hostname))
    throw new Error('instagram download URL must use instagram.com');
  const parts = input.pathname.split('/').filter(Boolean);
  const kindIndex = ['p', 'reel', 'tv'].includes(parts[0] ?? '')
    ? 0
    : ['p', 'reel', 'tv'].includes(parts[1] ?? '')
      ? 1
      : -1;
  const kind = kindIndex >= 0 ? parts[kindIndex] : '';
  const shortcode = kindIndex >= 0 ? parts[kindIndex + 1] : '';
  if (!kind || !shortcode) throw new Error('instagram download expects a post, reel, or tv URL');
  const variables = {
    shortcode,
    fetch_tagged_user_count: null,
    hoisted_comment_id: null,
    hoisted_reply_id: null,
  };
  const data = await new InstagramClient(context).request(
    `/graphql/query/?doc_id=8845758582119845&variables=${encodeURIComponent(JSON.stringify(variables))}`,
  );
  const media = object(object(data.data).xdt_shortcode_media);
  if (!Object.keys(media).length)
    throw new Error('instagram media is private, unavailable, or inaccessible to this session');
  const edges = object(media.edge_sidecar_to_children).edges;
  const nodes =
    Array.isArray(edges) && edges.length ? edges.map(edge => object(object(edge).node)) : [media];
  const items = nodes
    .map(node => ({
      type: flag(node.is_video) ? 'video' : 'image',
      url: text(flag(node.is_video) ? node.video_url : node.display_url),
    }))
    .filter(item => item.url);
  if (!items.length) throw new Error('instagram media contained no downloadable resources');
  const inline = flag(args.inline);
  if (inline && (items.length !== 1 || items[0]?.type !== 'image'))
    throw new Error(
      'instagram --inline supports exactly one image; use returned URLs for carousels and video',
    );
  let contentBase64 = '';
  if (inline && items[0]) {
    const response = await context.fetch({
      url: items[0].url,
      headers: { accept: 'image/*', referer: `https://www.instagram.com/${kind}/${shortcode}/` },
      responseType: 'base64',
      withCookies: true,
    });
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'base64')
      throw new Error(`instagram media download failed: HTTP ${response.status}`);
    contentBase64 = String(response.body);
  }
  return items.map((item, index) => ({
    index: index + 1,
    shortcode: text(media.shortcode) || shortcode,
    owner: text(object(media.owner).username),
    type: item.type,
    url: item.url,
    filename: `${shortcode}_${String(index + 1).padStart(2, '0')}.${item.type === 'video' ? 'mp4' : 'jpg'}`,
    status: inline ? 'inline' : 'available',
    content_base64: contentBase64,
  }));
}
