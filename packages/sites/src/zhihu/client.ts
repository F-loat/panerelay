import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export type Value = Record<string, unknown>;
export type Target =
  | { kind: 'user'; slug: string; url: string }
  | { kind: 'question'; id: string; url: string }
  | { kind: 'answer'; id: string; questionId: string; url: string }
  | { kind: 'article'; id: string; url: string };

export function object(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Value) : {};
}

export function pick(value: unknown, key: string): unknown {
  return object(value)[key];
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`zhihu ${name} is required`);
  return result;
}

export function integer(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < minimum || result > maximum) {
    throw new Error(`zhihu --${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return result;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

export function stripHtml(value: unknown, preserveBlocks = false): string {
  let result = String(value ?? '');
  if (preserveBlocks) {
    result = result
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n');
  }
  return decodeEntities(result.replace(/<[^>]*>/g, ' '))
    .replace(preserveBlocks ? /[ \t]+/g : /\s+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function unixTime(value: unknown): string {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : '';
}

export function userSlug(value: unknown): string {
  const raw = required(value, 'user');
  if (/^[A-Za-z0-9_-]+$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const match = url.pathname.match(/^\/people\/([A-Za-z0-9_-]+)\/?$/);
    if (url.protocol === 'https:' && url.hostname === 'www.zhihu.com' && match?.[1]) {
      return match[1];
    }
  } catch {
    // Fall through to the validation error below.
  }
  throw new Error('zhihu user must be a url_token or https://www.zhihu.com/people/<url_token>');
}

export function numericId(value: unknown, name: string): string {
  const result = required(value, name);
  if (!/^\d+$/.test(result)) throw new Error(`zhihu ${name} must be numeric`);
  return result;
}

export function parseAnswerTarget(value: unknown): { answerId: string; questionId: string } {
  const raw = required(value, 'answer id');
  if (/^\d+$/.test(raw)) return { answerId: raw, questionId: '' };
  const typed = raw.match(/^answer:(\d+):(\d+)$/);
  if (typed?.[1] && typed[2]) return { questionId: typed[1], answerId: typed[2] };
  try {
    const url = new URL(raw);
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'www.zhihu.com' || url.hostname === 'zhihu.com')
    ) {
      const canonical = url.pathname.match(/^\/question\/(\d+)\/answer\/(\d+)\/?$/);
      if (canonical?.[1] && canonical[2]) {
        return { questionId: canonical[1], answerId: canonical[2] };
      }
      const bare = url.pathname.match(/^\/answer\/(\d+)\/?$/);
      if (bare?.[1]) return { questionId: '', answerId: bare[1] };
    }
  } catch {
    // Fall through to the validation error below.
  }
  throw new Error(
    'zhihu answer id must be numeric, answer:<questionId>:<answerId>, or an answer URL',
  );
}

export function parseTarget(value: unknown): Target {
  const raw = required(value, 'target');
  let match = raw.match(/^user:([A-Za-z0-9_-]+)$/);
  if (match?.[1]) {
    return { kind: 'user', slug: match[1], url: `https://www.zhihu.com/people/${match[1]}` };
  }
  match = raw.match(/^question:(\d+)$/);
  if (match?.[1]) {
    return { kind: 'question', id: match[1], url: `https://www.zhihu.com/question/${match[1]}` };
  }
  match = raw.match(/^answer:(\d+):(\d+)$/);
  if (match?.[1] && match[2]) {
    return {
      kind: 'answer',
      questionId: match[1],
      id: match[2],
      url: `https://www.zhihu.com/question/${match[1]}/answer/${match[2]}`,
    };
  }
  match = raw.match(/^article:(\d+)$/);
  if (match?.[1]) {
    return { kind: 'article', id: match[1], url: `https://zhuanlan.zhihu.com/p/${match[1]}` };
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error();
    if (url.hostname === 'www.zhihu.com') {
      match = url.pathname.match(/^\/people\/([A-Za-z0-9_-]+)\/?$/);
      if (match?.[1])
        return { kind: 'user', slug: match[1], url: `https://www.zhihu.com/people/${match[1]}` };
      match = url.pathname.match(/^\/question\/(\d+)\/?$/);
      if (match?.[1])
        return {
          kind: 'question',
          id: match[1],
          url: `https://www.zhihu.com/question/${match[1]}`,
        };
      match = url.pathname.match(/^\/question\/(\d+)\/answer\/(\d+)\/?$/);
      if (match?.[1] && match[2]) {
        return {
          kind: 'answer',
          questionId: match[1],
          id: match[2],
          url: `https://www.zhihu.com/question/${match[1]}/answer/${match[2]}`,
        };
      }
    }
    if (url.hostname === 'zhuanlan.zhihu.com') {
      match = url.pathname.match(/^\/p\/(\d+)\/?$/);
      if (match?.[1])
        return { kind: 'article', id: match[1], url: `https://zhuanlan.zhihu.com/p/${match[1]}` };
    }
  } catch {
    // Fall through to the validation error below.
  }
  throw new Error('zhihu target must be a supported Zhihu HTTPS URL or typed target');
}

export function requireKind<T extends Target['kind']>(
  target: Target,
  command: string,
  allowed: readonly T[],
): Extract<Target, { kind: T }> {
  if (!allowed.includes(target.kind as T)) {
    throw new Error(`zhihu ${command} does not support ${target.kind} targets`);
  }
  return target as Extract<Target, { kind: T }>;
}

export function requireExecute(args: Record<string, unknown>): void {
  if (args.execute !== true && text(args.execute).toLowerCase() !== 'true') {
    throw new Error('this Zhihu write command requires --execute');
  }
}

export function payload(args: Record<string, unknown>): string {
  if (text(args.file)) {
    throw new Error('zhihu --file is unavailable in fetch adapters; pass inline <text> instead');
  }
  const result = text(args.text);
  if (!result) throw new Error('zhihu payload cannot be empty or whitespace only');
  return result;
}

function normalizeApiUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !['www.zhihu.com', 'api.zhihu.com'].includes(url.hostname)) {
      return '';
    }
    if (url.hostname === 'api.zhihu.com') {
      if (url.pathname === '/search_v3')
        return `https://www.zhihu.com/api/v4/search_v3${url.search}`;
      if (/^\/(members|answers|questions|articles|collections|people)\//.test(url.pathname)) {
        return `https://www.zhihu.com/api/v4${url.pathname}${url.search}`;
      }
      if (url.pathname.startsWith('/topstory/')) {
        return `https://www.zhihu.com/api/v3/feed${url.pathname}${url.search}`;
      }
    }
    return url.toString();
  } catch {
    return '';
  }
}

export class ZhihuClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async get(path: string): Promise<unknown> {
    const url = normalizeApiUrl(new URL(path, 'https://www.zhihu.com').href);
    if (!url) throw new Error('zhihu API URL is invalid');
    const request: BrowserFetchRequest = {
      url,
      headers: { accept: 'application/json', referer: 'https://www.zhihu.com/' },
      responseType: 'json',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 401 || response.status === 403) {
      throw new Error('zhihu requires a valid logged-in browser session');
    }
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json') {
      throw new Error(`zhihu request failed: HTTP ${response.status}`);
    }
    return response.body;
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    const url = normalizeApiUrl(new URL(path, 'https://www.zhihu.com').href);
    if (!url) throw new Error('zhihu API URL is invalid');
    const request: BrowserFetchRequest = {
      url,
      method: 'POST',
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        origin: 'https://www.zhihu.com',
        referer: 'https://www.zhihu.com/',
      },
      ...(body === undefined
        ? {}
        : { body: { encoding: 'utf8' as const, data: JSON.stringify(body) } }),
      bindings: ['zhihu-xsrf'],
      responseType: 'auto',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 401 || response.status === 403) {
      throw new Error('zhihu requires a valid logged-in browser session');
    }
    if (response.status < 200 || response.status >= 300) {
      const error =
        text(pick(response.body, 'message')) || text(pick(pick(response.body, 'error'), 'message'));
      throw new Error(
        `zhihu write request failed: HTTP ${response.status}${error ? `: ${error}` : ''}`,
      );
    }
    return response.bodyType === 'json' ? response.body : {};
  }

  async me(): Promise<Value> {
    const result = object(await this.get('/api/v4/me?include=url_token'));
    if (!text(pick(result, 'url_token'))) {
      throw new Error('zhihu requires a valid logged-in browser session');
    }
    return result;
  }

  async list(firstUrl: string, limit: number, label: string): Promise<Value[]> {
    const rows: Value[] = [];
    const visited = new Set<string>();
    let url = normalizeApiUrl(firstUrl);
    while (url && rows.length < limit && !visited.has(url)) {
      visited.add(url);
      const data = object(await this.get(url));
      const items = pick(data, 'data');
      if (!Array.isArray(items)) throw new Error(`zhihu ${label} response is malformed`);
      for (const item of items) {
        rows.push(object(item));
        if (rows.length >= limit) break;
      }
      const paging = object(pick(data, 'paging'));
      if (pick(paging, 'is_end') === true) break;
      const next = normalizeApiUrl(pick(paging, 'next'));
      if (!next || visited.has(next)) break;
      url = next;
    }
    return rows;
  }
}

export function answerIdFrom(value: Value): string {
  const url = text(pick(value, 'url'));
  try {
    const match = new URL(url).pathname.match(
      /\/(?:question\/\d+\/answer|api\/v4\/answers|answer)\/(\d+)\/?$/,
    );
    if (match?.[1]) return match[1];
  } catch {
    // Fall back to the explicit answer id field.
  }
  const id = pick(value, 'id');
  if (typeof id === 'string' && /^\d+$/.test(id)) return id;
  if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) return String(id);
  return '';
}

export function writeRow(
  message: string,
  targetType: string,
  target: string,
  outcome: 'created' | 'applied',
  extra: Value = {},
) {
  return [{ status: 'success', outcome, message, target_type: targetType, target, ...extra }];
}
