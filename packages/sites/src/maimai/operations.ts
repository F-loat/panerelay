import { randomUUID } from 'node:crypto';
import { SiteError, type SiteCommandContext } from '@panerelay/site-kit';
type Args = Record<string, unknown>;
type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}
function text(value: unknown) {
  return String(value ?? '').trim();
}
function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}
function number(value: unknown, fallback: number, minimum: number, maximum: number, name: string) {
  const parsed = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`maimai ${name} must be between ${minimum} and ${maximum}`);
  return parsed;
}

async function page(context: SiteCommandContext, url: string) {
  const response = await context.fetch({
    url,
    headers: { accept: 'text/html' },
    responseType: 'text',
    withCookies: true,
  });
  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status < 200 ||
    response.status >= 300 ||
    response.bodyType !== 'text'
  )
    throw new SiteError('auth-required', 'Maimai requires a valid logged-in browser session');
  return String(response.body);
}

export async function whoami(context: SiteCommandContext) {
  const html = await page(context, 'https://maimai.cn/');
  const raw = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  let metadata: JsonObject;
  try {
    metadata = object(JSON.parse(raw ?? ''));
  } catch {
    throw new SiteError('shape-drift', 'Maimai returned malformed Next metadata');
  }
  const buildId = text(metadata.buildId);
  let assetPrefix: URL;
  try {
    assetPrefix = new URL(text(metadata.assetPrefix));
  } catch {
    throw new SiteError('shape-drift', 'Maimai Next asset prefix is unavailable');
  }
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(buildId) ||
    !['maimai.cn', 's.taou.com'].includes(assetPrefix.hostname) ||
    assetPrefix.pathname.replace(/\/$/, '') !== '/n/platform'
  ) {
    throw new SiteError('shape-drift', 'Maimai Next metadata is outside the expected route');
  }
  const response = await context.fetch({
    url: `https://maimai.cn/n/platform/_next/data/${buildId}/api/auth/get_user.json`,
    headers: { accept: 'application/json', referer: 'https://maimai.cn/' },
    responseType: 'json',
    withCookies: true,
  });
  if (response.status === 401 || response.status === 403)
    throw new SiteError('auth-required', 'Maimai requires a valid logged-in browser session');
  if (response.status < 200 || response.status >= 300)
    throw new SiteError(
      'upstream-failure',
      `Maimai user endpoint failed with HTTP ${response.status}`,
    );
  if (response.bodyType !== 'json')
    throw new SiteError('shape-drift', 'Maimai user endpoint returned non-JSON');
  const user = object(object(response.body).user);
  const id = text(user.id);
  if (!id)
    throw new SiteError('auth-required', 'Maimai requires a valid logged-in browser session');
  return [
    {
      logged_in: true,
      site: 'maimai',
      user_id: id,
      name: text(user.realname ?? user.username),
      company: text(user.company),
    },
  ];
}

export async function searchTalents(context: SiteCommandContext, args: Args) {
  const query = text(args.query);
  if (!query) throw new Error('maimai query is required');
  const pageNumber = number(args.page, 0, 0, 100, 'page');
  const size = number(args.size, 20, 1, 100, 'size');
  const search = {
    page: pageNumber,
    size,
    sessionid: randomUUID(),
    deletesessionid: randomUUID(),
    worktimes: text(args.worktimes),
    degrees: text(args.degrees),
    professions: text(args.professions),
    schools: text(args.schools),
    positions: text(args.positions),
    companyscope: 0,
    sortby: number(args.sortby, 0, 0, 3, 'sortby'),
    is_direct_chat: number(args['is-direct-chat'], 0, 0, 1, 'is-direct-chat'),
    query,
    cities: text(args.cities),
    provinces: text(args.provinces),
    is_211: number(args['is-211'], 0, 0, 1, 'is-211'),
    is_985: number(args['is-985'], 0, 0, 1, 'is-985'),
    allcompanies: text(args.companies),
  };
  const response = await context.fetch({
    url: 'https://maimai.cn/api/ent/discover/search?channel=www&data_version=3.0&version=1.0.0',
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'text/plain;charset=UTF-8',
      origin: 'https://maimai.cn',
      referer: 'https://maimai.cn/ent/talents/discover/search_v2',
    },
    bindings: ['maimai-csrf'],
    body: { encoding: 'utf8', data: JSON.stringify({ search }) },
    responseType: 'json',
    withCookies: true,
  });
  if (response.status === 401 || response.status === 403)
    throw new Error('maimai requires a valid logged-in browser session');
  if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
    throw new Error(`maimai search failed: HTTP ${response.status}`);
  const body = object(response.body);
  if (Number(body.error_code) === 20002)
    throw new Error('maimai requires a valid logged-in browser session');
  if (![0, 200].includes(Number(body.code)))
    throw new Error(text(body.message ?? body.error) || `maimai API error ${body.code}`);
  const data = object(body.data);
  const candidates = [data.list, data.talent_list, body.list, body.talent_list];
  const rows = candidates.find(Array.isArray);
  if (!rows) throw new Error('maimai search response did not contain a talent list');
  return rows.map(raw => {
    const item = object(raw);
    const education = object(list(item.edu)[0]);
    const current = text(item.company);
    const historical = [
      ...new Set(
        list(item.exp)
          .map(entry => text(object(entry).company))
          .filter(company => company && company !== current),
      ),
    ].join(' / ');
    const tags = list(item.tag_list ?? item.tags)
      .map(text)
      .filter(Boolean)
      .join(', ');
    const friends = list(item.friends ?? item.common_friends)
      .map(entry =>
        typeof entry === 'string' ? entry : text(object(entry).name ?? object(entry).user_name),
      )
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    const friendCount = Number(item.friends_cnt ?? item.common_friends_count ?? 0);
    return {
      name: text(item.name),
      job_title: text(item.position ?? item.job_title),
      company: current,
      historical_companies: historical,
      location: `${text(item.province)}${text(item.city) ? `·${text(item.city)}` : ''}`,
      work_year: text(item.work_time ?? item.worktime),
      school: text(education.school ?? object(education.hover).name),
      degree: text(education.sdegree ?? object(education.hover).school_level),
      active_status: text(item.active_state_v2 ?? item.active_state_v1 ?? item.active_state),
      age: text(item.age),
      tags,
      mutual_friends: friendCount > 0 ? `${friendCount}人${friends ? ` (${friends})` : ''}` : '',
    };
  });
}
