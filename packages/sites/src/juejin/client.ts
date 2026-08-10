import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://api.juejin.cn';
export const POST_URL = 'https://juejin.cn/post';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function bounded(
  value: unknown,
  fallback: number,
  maximum: number,
  label = 'limit',
): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw new Error(`juejin ${label} must be an integer between 1 and ${maximum}`);
  }
  return result;
}

export function cursor(value: unknown): string {
  const result = text(value || '0');
  if (!/^(0|[1-9]\d*)$/.test(result))
    throw new Error('juejin cursor must be a non-negative decimal integer');
  return result;
}

export const CATEGORIES: Record<string, string> = {
  backend: '6809637769959178254',
  frontend: '6809637767543259144',
  android: '6809635626879549454',
  ios: '6809635626661445640',
  ai: '6809637773935378440',
};

export function category(value: unknown): string {
  const result = text(value || 'backend');
  if (/^\d{16,20}$/.test(result)) return result;
  const alias = CATEGORIES[result.toLowerCase()];
  if (alias) return alias;
  throw new Error(`juejin category must be an id or one of: ${Object.keys(CATEGORIES).join(', ')}`);
}

export class JuejinClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async request(path: string, body?: unknown): Promise<Value> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      method: body === undefined ? 'GET' : 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : { encoding: 'utf8', data: JSON.stringify(body) },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 429) throw new Error('juejin returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json') {
      throw new Error(`juejin request failed: HTTP ${response.status}`);
    }
    const payload = response.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw new Error('juejin returned a malformed API envelope');
    if (Number(pick(payload, 'err_no')) !== 0)
      throw new Error(
        `juejin returned err_no ${String(pick(payload, 'err_no'))}: ${text(pick(payload, 'err_msg'))}`,
      );
    return payload as Value;
  }
}

export function dataRows(payload: Value, label: string): unknown[] {
  const data = pick(payload, 'data');
  if (!Array.isArray(data) || data.length === 0) throw new Error(`${label} returned no articles`);
  return data;
}

function articleId(value: unknown): string {
  const result = text(value);
  if (!/^\d{16,20}$/.test(result)) throw new Error('juejin returned a malformed article id');
  return result;
}

export function feedRow(row: unknown, rank: number): Record<string, unknown> {
  const info = pick(row, 'item_info');
  const article = pick(info, 'article_info');
  const author = pick(info, 'author_user_info');
  const id = articleId(pick(article, 'article_id'));
  const tags = pick(info, 'tags');
  return {
    rank,
    article_id: id,
    title: text(pick(article, 'title')),
    brief: text(pick(article, 'brief_content')),
    views: Number(pick(article, 'view_count')) || 0,
    likes: Number(pick(article, 'digg_count')) || 0,
    comments: Number(pick(article, 'comment_count')) || 0,
    author: text(pick(author, 'user_name')),
    tags: Array.isArray(tags)
      ? tags
          .map(tag => text(pick(tag, 'tag_name')))
          .filter(Boolean)
          .slice(0, 6)
          .join(', ')
      : '',
    url: `${POST_URL}/${id}`,
  };
}

export function hotRow(row: unknown, rank: number): Record<string, unknown> {
  const content = pick(row, 'content');
  const counter = pick(row, 'content_counter');
  const author = pick(row, 'author');
  const id = articleId(pick(content, 'content_id'));
  return {
    rank,
    article_id: id,
    title: text(pick(content, 'title')),
    brief: text(pick(content, 'brief')),
    views: Number(pick(counter, 'view')) || 0,
    likes: Number(pick(counter, 'like')) || 0,
    comments: Number(pick(counter, 'comment_count')) || 0,
    hot_rank: Number(pick(counter, 'hot_rank')) || 0,
    author: text(pick(author, 'name')),
    url: `${POST_URL}/${id}`,
  };
}
