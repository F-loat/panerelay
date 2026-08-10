import type { SiteCommandContext } from '@panerelay/site-kit';
import { boundedInt, DevtoClient, pick, text } from './client.js';

export function mapArticles(body: unknown, page: number, limit: number, includeAuthor: boolean) {
  const articles = Array.isArray(body) ? body : [];
  return articles.map((article, index) => ({
    rank: (page - 1) * limit + index + 1,
    id: pick(article, 'id') ?? null,
    title: text(pick(article, 'title')),
    ...(includeAuthor ? { author: text(pick(pick(article, 'user'), 'username')) } : {}),
    reactions: pick(article, 'public_reactions_count') ?? null,
    comments: pick(article, 'comments_count') ?? null,
    readingTime: pick(article, 'reading_time_minutes') ?? null,
    published: text(pick(article, 'published_at')),
    tags: Array.isArray(pick(article, 'tag_list'))
      ? (pick(article, 'tag_list') as unknown[]).map(text).join(', ')
      : text(pick(article, 'tag_list')),
    url: text(pick(article, 'url')),
  }));
}

export async function runList(
  context: SiteCommandContext,
  args: Record<string, unknown>,
  name: 'latest' | 'top' | 'tag' | 'user',
  queryName?: string,
): Promise<unknown[]> {
  const includeAuthor = name !== 'user';
  const limit = boundedInt(args.limit, 20, 100, 'limit');
  const page = name === 'latest' ? boundedInt(args.page, 1, 1000, 'page') : 1;
  const query: Record<string, string> = { per_page: String(limit) };
  if (name === 'latest') query.page = String(page);
  if (name === 'top') query.top = '1';
  if (queryName) {
    const value = text(args[queryName]);
    if (!value) throw new Error(`devto ${queryName} cannot be empty`);
    query[queryName] = value;
  }
  const path = name === 'latest' ? '/articles/latest' : '/articles';
  return mapArticles(await new DevtoClient(context).json(path, query), page, limit, includeAuthor);
}
