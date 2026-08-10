import type { SiteCommandContext } from '@panerelay/site-kit';

type Args = Record<string, unknown>;
type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function clean(value: unknown): string {
  return text(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`reuters ${name} is required`);
  return result;
}

function limit(value: unknown): number {
  const parsed = value == null || value === '' ? 10 : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 40) {
    throw new Error('reuters limit must be between 1 and 40');
  }
  return parsed;
}

function challenge(value: unknown): boolean {
  return /datadome|captcha|verify you are human|human verification|access to this page has been denied|unusual traffic|subscribe to continue|subscription required/i.test(
    text(value),
  );
}

function articleUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://www.reuters.com${raw}`;
}

function authors(value: unknown): string {
  return (Array.isArray(value) ? value : [])
    .map(entry =>
      typeof entry === 'string' ? entry : text(object(entry).name ?? object(entry).byline),
    )
    .map(text)
    .filter(Boolean)
    .join(', ');
}

async function fetchResponse(
  context: SiteCommandContext,
  url: string,
  responseType: 'json' | 'text',
) {
  const response = await context.fetch({
    url,
    headers: {
      accept: responseType === 'json' ? 'application/json' : 'text/html',
      referer: 'https://www.reuters.com/',
    },
    responseType,
    withCookies: true,
  });
  if (response.status === 401 || response.status === 403 || challenge(response.body)) {
    throw new Error(
      'reuters requires an accessible browser session with any human verification completed',
    );
  }
  if (response.status < 200 || response.status >= 300 || response.bodyType !== responseType) {
    throw new Error(`reuters request failed: HTTP ${response.status}`);
  }
  return response.body;
}

export async function search(context: SiteCommandContext, args: Args) {
  const keyword = required(args.query, 'query');
  const take = limit(args.limit);
  const query = JSON.stringify({
    keyword,
    offset: 0,
    orderby: 'display_date:desc',
    size: take,
    website: 'reuters',
  });
  const body = object(
    await fetchResponse(
      context,
      `https://www.reuters.com/pf/api/v3/content/fetch/articles-by-search-v2?query=${encodeURIComponent(query)}`,
      'json',
    ),
  );
  const result = object(body.result);
  const source = Array.isArray(result.articles)
    ? result.articles
    : Array.isArray(body.articles)
      ? body.articles
      : [];
  return source
    .slice(0, take)
    .map((raw, index) => {
      const article = object(raw);
      const taxonomy = object(article.taxonomy);
      const section = object(taxonomy.section);
      return {
        rank: index + 1,
        title: text(article.title ?? object(article.headlines).basic),
        date: text(article.display_date ?? article.published_time).split('T')[0],
        section: text(section.name),
        section_path: text(section.path),
        authors: authors(article.authors),
        url: articleUrl(article.canonical_url),
      };
    })
    .filter(row => row.title && row.url);
}

function parseFusion(html: string): JsonObject {
  const raw = html.match(/<script[^>]+id=["']fusion-metadata["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) return {};
  try {
    return object(JSON.parse(raw));
  } catch {
    return {};
  }
}

export async function articleDetail(context: SiteCommandContext, args: Args) {
  const url = new URL(required(args.url, 'url'));
  if (!/(^|\.)reuters\.com$/i.test(url.hostname))
    throw new Error('reuters article URL must use reuters.com');
  const html = String(await fetchResponse(context, url.toString(), 'text'));
  if (challenge(html.slice(0, 10_000)))
    throw new Error('reuters article returned a challenge or paywall');
  const article = object(parseFusion(html).globalContent);
  const paragraphs = [
    ...html.matchAll(
      /<(?:p|div)[^>]+data-testid=["']paragraph-[^"']+["'][^>]*>([\s\S]*?)<\/(?:p|div)>/gi,
    ),
  ]
    .map(match => clean(match[1]))
    .filter(Boolean);
  const fallback = paragraphs.length
    ? paragraphs
    : [...html.matchAll(/<article\b[^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
        .map(match => clean(match[1]))
        .filter(Boolean);
  if (!Object.keys(article).length && !fallback.length)
    throw new Error('reuters article body was not present in the HTTP response');
  const taxonomy = object(article.taxonomy);
  const section = object(taxonomy.section);
  return [
    {
      title:
        text(article.title ?? object(article.headlines).basic) ||
        clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
      date: text(article.display_date ?? article.published_time).split('T')[0],
      section: text(section.name),
      section_path: text(section.path),
      authors: authors(article.authors),
      description: text(object(article.description).basic ?? object(article.subheadlines).basic),
      word_count: article.word_count ?? '',
      url: articleUrl(article.canonical_url) || url.toString(),
      body: fallback.join('\n\n'),
    },
  ];
}
