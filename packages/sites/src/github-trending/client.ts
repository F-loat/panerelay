import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://github.com';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function text(value: unknown): string {
  return String(value ?? '').trim();
}
export function bounded(value: unknown): number {
  const result = value == null ? 25 : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 25)
    throw new Error('github-trending limit must be an integer between 1 and 25');
  return result;
}
export function since(value: unknown): string {
  const result = text(value || 'daily').toLowerCase();
  if (!['daily', 'weekly', 'monthly'].includes(result))
    throw new Error('github-trending since must be daily, weekly, or monthly');
  return result;
}
function decode(value: unknown): string {
  return text(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');
}
function strip(value: unknown): string {
  return text(value).replace(/<[^>]*>/g, '');
}
function count(value: unknown, field: string, repo: string): number {
  const digits = strip(value).replace(/[,\s]/g, '');
  if (!/^\d+$/.test(digits))
    throw new Error(`github-trending parser drift: missing ${field} for ${repo}`);
  return Number(digits);
}
function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function empty(html: string): boolean {
  return /don.t have any trending repositories|no trending repositories/i.test(strip(html));
}

export function parse(html: string, limit: number): Array<Record<string, unknown>> {
  const blocks = [
    ...html.matchAll(/<article\b[^>]*class="[^"]*\bBox-row\b[^"]*"[^>]*>([\s\S]*?)<\/article>/g),
  ].map(match => match[1] ?? '');
  if (!blocks.length) {
    if (empty(html)) return [];
    throw new Error('github-trending parser drift: no repository rows found');
  }
  const rows: Array<Record<string, unknown>> = [];
  for (const block of blocks) {
    const name = block.match(/<h2\b[\s\S]*?href="\/([^"/?#]+\/[^"/?#]+)"/)?.[1];
    if (!name || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name))
      throw new Error('github-trending parser drift: missing repository link');
    const repo = decode(name);
    const description = decode(
      strip(block.match(/<p class="col-9 color-fg-muted[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? '').replace(
        /\s+/g,
        ' ',
      ),
    );
    const language = block.match(/<span itemprop="programmingLanguage">([\s\S]*?)<\/span>/)?.[1];
    const repoPattern = escaped(repo);
    const stars = block.match(
      new RegExp(`<a\\b[^>]*href="/${repoPattern}/stargazers"[^>]*>([\\s\\S]*?)</a>`),
    );
    const forks = block.match(
      new RegExp(`<a\\b[^>]*href="/${repoPattern}/forks"[^>]*>([\\s\\S]*?)</a>`),
    );
    const period = block.match(/([\d,]+)\s+stars\s+(?:today|this week|this month)/i)?.[1];
    rows.push({
      repo,
      description: description.trim(),
      language: language ? decode(strip(language)) : null,
      stars: count(stars?.[1], 'stars', repo),
      forks: count(forks?.[1], 'forks', repo),
      starsSince: count(period, 'period stars', repo),
      url: `${BASE}/${repo}`,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

export class GitHubTrendingClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async request(language: string, period: string): Promise<string> {
    const path = language ? `/trending/${encodeURIComponent(language)}` : '/trending';
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      query: [{ name: 'since', value: period }],
      headers: { accept: 'text/html' },
      responseType: 'text',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'text')
      throw new Error(`github-trending request failed: HTTP ${response.status}`);
    return text(response.body);
  }
}
