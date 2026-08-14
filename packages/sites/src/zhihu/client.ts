import type {
  BrowserFetchRequest,
  BrowserFetchResponse,
  SiteCommandContext,
} from '@panerelay/site-kit';

export type Value = Record<string, unknown>;
export type Target =
  | { kind: 'user'; slug: string; url: string }
  | { kind: 'question'; id: string; url: string }
  | { kind: 'answer'; id: string; questionId: string; url: string }
  | { kind: 'article'; id: string; url: string }
  | { kind: 'comment'; id: string; url: string };

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

export function parseCommentTarget(value: unknown): Extract<Target, { kind: 'comment' }> {
  const raw = required(value, 'comment');
  const typed = raw.match(/^comment:(\d+)$/);
  if (/^\d+$/.test(raw) || typed?.[1]) {
    const id = typed?.[1] ?? raw;
    return { kind: 'comment', id, url: `https://www.zhihu.com/api/v4/comments/${id}` };
  }
  try {
    const url = new URL(raw);
    const match = url.hash.match(/^#comment-(\d+)$/);
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'www.zhihu.com' || url.hostname === 'zhihu.com') &&
      match?.[1]
    ) {
      return {
        kind: 'comment',
        id: match[1],
        url: `https://www.zhihu.com/api/v4/comments/${match[1]}`,
      };
    }
  } catch {
    // Fall through to the validation error below.
  }
  throw new Error('zhihu comment must be numeric, comment:<id>, or a Zhihu URL with #comment-<id>');
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
  match = raw.match(/^comment:(\d+)$/);
  if (match?.[1]) {
    return {
      kind: 'comment',
      id: match[1],
      url: `https://www.zhihu.com/api/v4/comments/${match[1]}`,
    };
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error();
    if (url.hostname === 'www.zhihu.com') {
      match = url.hash.match(/^#comment-(\d+)$/);
      if (match?.[1]) {
        return {
          kind: 'comment',
          id: match[1],
          url: `https://www.zhihu.com/api/v4/comments/${match[1]}`,
        };
      }
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
    if (
      url.protocol !== 'https:' ||
      !['www.zhihu.com', 'api.zhihu.com', 'zhuanlan.zhihu.com'].includes(url.hostname)
    ) {
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
    if (url.hostname === 'zhuanlan.zhihu.com') {
      if (
        url.search ||
        !(
          url.pathname === '/api/articles/drafts' ||
          /^\/api\/articles\/\d+(?:\/draft)?$/.test(url.pathname)
        )
      ) {
        return '';
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

  async articleDraft(id: string): Promise<Value | null> {
    const response = await this.#articleRequest(
      'GET',
      `https://zhuanlan.zhihu.com/api/articles/${numericId(id, 'article id')}/draft`,
    );
    if (response.status === 404) return null;
    return this.#articleJson(response, 'draft read');
  }

  async article(id: string): Promise<Value | null> {
    const response = await this.#articleRequest(
      'GET',
      `https://zhuanlan.zhihu.com/api/articles/${numericId(id, 'article id')}`,
    );
    if (response.status === 404) return null;
    return this.#articleJson(response, 'article read');
  }

  async createArticleDraft(body: Value): Promise<Value> {
    const response = await this.#articleRequest(
      'POST',
      'https://zhuanlan.zhihu.com/api/articles/drafts',
      body,
    );
    return this.#articleJson(response, 'draft creation');
  }

  async updateArticleDraft(id: string, body: Value): Promise<Value> {
    const response = await this.#articleRequest(
      'PATCH',
      `https://zhuanlan.zhihu.com/api/articles/${numericId(id, 'article id')}/draft`,
      body,
    );
    return this.#articleJson(response, 'draft update');
  }

  async deleteArticleDraft(id: string): Promise<void> {
    const response = await this.#articleRequest(
      'DELETE',
      `https://zhuanlan.zhihu.com/api/articles/${numericId(id, 'article id')}/draft`,
    );
    if (response.status === 401 || response.status === 403) {
      throw new Error('zhihu requires a valid logged-in browser session');
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`zhihu draft deletion failed: HTTP ${response.status}`);
    }
  }

  async comment(id: string): Promise<Value | null> {
    const url = `https://www.zhihu.com/api/v4/comments/${numericId(id, 'comment id')}`;
    let response: BrowserFetchResponse | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      response = await this.#context.fetch({
        url,
        headers: { accept: 'application/json', referer: 'https://www.zhihu.com/' },
        responseType: 'json',
        withCookies: true,
      });
      if (response.status < 500 || response.status >= 600 || attempt === 4) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!response) throw new Error('zhihu comment read did not issue a request');
    if (response.status === 404) return null;
    if (response.status === 401 || response.status === 403) {
      throw new Error('zhihu requires a valid logged-in browser session');
    }
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json') {
      throw new Error(`zhihu comment read failed: HTTP ${response.status}`);
    }
    return object(response.body);
  }

  async deleteComment(id: string): Promise<void> {
    await this.#wwwWrite(
      'DELETE',
      `/api/v4/comment_v5/comment/${numericId(id, 'comment id')}`,
      undefined,
      'comment deletion',
    );
  }

  async #articleRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    input: string,
    body?: Value,
  ): Promise<BrowserFetchResponse> {
    const url = normalizeApiUrl(input);
    if (!url || new URL(url).hostname !== 'zhuanlan.zhihu.com') {
      throw new Error('zhihu article API URL is invalid');
    }
    const request: BrowserFetchRequest = {
      url,
      method,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(method === 'GET'
          ? { referer: 'https://zhuanlan.zhihu.com/write' }
          : {
              origin: 'https://zhuanlan.zhihu.com',
              referer: 'https://zhuanlan.zhihu.com/write',
              'x-requested-with': 'fetch',
            }),
      },
      ...(body === undefined
        ? {}
        : { body: { encoding: 'utf8' as const, data: JSON.stringify(body) } }),
      ...(method === 'GET' ? {} : { bindings: ['zhihu-xsrf'] }),
      responseType: method === 'DELETE' ? 'auto' : 'json',
      withCookies: true,
    };
    return this.#context.fetch(request);
  }

  #articleJson(response: BrowserFetchResponse, operation: string): Value {
    if (response.status === 401 || response.status === 403) {
      throw new Error('zhihu requires a valid logged-in browser session');
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`zhihu ${operation} failed: HTTP ${response.status}`);
    }
    if (response.bodyType !== 'json') {
      throw new Error(`zhihu ${operation} response is malformed`);
    }
    return object(response.body);
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    return this.#wwwWrite('POST', path, body, 'write request');
  }

  async #wwwWrite(
    method: 'POST' | 'DELETE',
    path: string,
    body: unknown,
    operation: string,
  ): Promise<Value> {
    const url = normalizeApiUrl(new URL(path, 'https://www.zhihu.com').href);
    if (!url) throw new Error('zhihu API URL is invalid');
    const request: BrowserFetchRequest = {
      url,
      method,
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
        `zhihu ${operation} failed: HTTP ${response.status}${error ? `: ${error}` : ''}`,
      );
    }
    return response.bodyType === 'json' ? object(response.body) : {};
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
