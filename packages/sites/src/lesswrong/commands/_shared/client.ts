import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const DOMAIN = 'www.lesswrong.com';
type Value = Record<string, unknown>;
export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`lesswrong ${label} cannot be empty`);
  return result;
}
export function escape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`lesswrong limit must be an integer between 1 and ${maximum}`);
  return result;
}
export function strip(value: unknown): string {
  return text(value)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function postUrl(item: Value): string {
  return `https://${DOMAIN}/posts/${text(pick(item, '_id'))}/${text(pick(item, 'slug'))}`;
}
export function postRows(value: unknown): Value[] {
  const rows = pick(pick(value, 'posts'), 'results');
  return Array.isArray(rows)
    ? (rows.filter(item => item && typeof item === 'object') as Value[])
    : [];
}
export function mapPost(item: Value, rank: number): Value {
  return {
    rank,
    title: text(pick(item, 'title')),
    author: text(pick(pick(item, 'user'), 'displayName')),
    karma: Number(pick(item, 'baseScore')) || 0,
    comments: Number(pick(item, 'commentCount')) || 0,
    url: postUrl(item),
  };
}
export async function gql(context: SiteCommandContext, query: string): Promise<Value> {
  const request: BrowserFetchRequest = {
    url: `https://${DOMAIN}/graphql`,
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: { encoding: 'utf8', data: JSON.stringify({ query }) },
    responseType: 'json',
    withCookies: false,
  };
  const response = await context.fetch(request);
  if (
    response.status < 200 ||
    response.status >= 300 ||
    response.bodyType !== 'json' ||
    !response.body ||
    typeof response.body !== 'object' ||
    Array.isArray(response.body)
  )
    throw new Error(`lesswrong GraphQL request failed: HTTP ${response.status}`);
  const value = response.body as Value;
  const errors = pick(value, 'errors');
  if (Array.isArray(errors) && errors.length)
    throw new Error(`lesswrong GraphQL error: ${text(pick(errors[0], 'message'))}`);
  return (pick(value, 'data') || {}) as Value;
}
export async function list(
  context: SiteCommandContext,
  view: string,
  value: unknown,
  after = '',
  terms = '',
): Promise<Value[]> {
  const limit = bounded(value, 10);
  const suffix = after ? `, after: "${escape(after)}"` : '';
  const data = await gql(
    context,
    `query PostsList { posts(input: {terms: {view: "${view}", limit: ${limit}${suffix}${terms}}}) { results { _id title user { displayName } baseScore commentCount slug postedAt tags { name } } } }`,
  );
  const rows = postRows(data);
  if (!rows.length) throw new Error(`lesswrong ${view} returned no posts`);
  return rows.slice(0, limit);
}
export function postId(value: unknown): string {
  const result = text(value);
  const match = result.match(/posts\/([a-zA-Z0-9]+)/);
  return match?.[1] || result;
}
