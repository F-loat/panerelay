import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export type Value = Record<string, unknown>;

export function object(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Value) : {};
}

export function pick(value: unknown, key: string): unknown {
  return object(value)[key];
}

export function text(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`zsxq ${name} is required`);
  return result;
}

export function bounded(value: unknown, fallback: number, maximum = 100): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > maximum)
    throw new Error(`zsxq value must be an integer between 1 and ${maximum}`);
  return result;
}

export class ZsxqClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async get(path: string): Promise<Value> {
    const request: BrowserFetchRequest = {
      url: new URL(path, 'https://api.zsxq.com').href,
      headers: {
        accept: 'application/json, text/plain, */*',
        referer: 'https://wx.zsxq.com/',
      },
      responseType: 'json',
      withCookies: true,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 401 || response.status === 403)
      throw new Error('zsxq requires a valid logged-in browser session');
    if (
      response.status < 200 ||
      response.status >= 300 ||
      response.bodyType !== 'json' ||
      !response.body ||
      typeof response.body !== 'object' ||
      Array.isArray(response.body)
    )
      throw new Error(`zsxq request failed: HTTP ${response.status}`);
    const payload = response.body as Value;
    if (pick(payload, 'succeeded') === false)
      throw new Error(text(pick(payload, 'info') ?? pick(payload, 'error')) || 'zsxq API failed');
    return payload;
  }
}

export function responseData(payload: Value): unknown {
  return pick(payload, 'resp_data') ?? pick(payload, 'data') ?? payload;
}

function firstArray(...values: unknown[]): Value[] {
  for (const value of values) if (Array.isArray(value)) return value.map(object);
  return [];
}

export function groups(payload: Value): Value[] {
  const data = responseData(payload);
  return Array.isArray(data)
    ? data.map(object)
    : firstArray(pick(data, 'groups'), pick(data, 'list'), pick(data, 'items'));
}

export function topics(payload: Value): Value[] {
  const data = responseData(payload);
  return Array.isArray(data)
    ? data.map(object)
    : firstArray(
        pick(data, 'topics'),
        pick(data, 'list'),
        pick(data, 'records'),
        pick(data, 'items'),
        pick(data, 'search_result'),
      );
}

export function comments(payload: Value): Value[] {
  const data = responseData(payload);
  return Array.isArray(data)
    ? data.map(object)
    : firstArray(pick(data, 'comments'), pick(data, 'list'), pick(data, 'items'));
}

export function topic(payload: Value): Value | undefined {
  const data = responseData(payload);
  if (Array.isArray(data)) return data.length ? object(data[0]) : undefined;
  const record = object(data);
  if (pick(record, 'topic_id') != null) return record;
  const nested = pick(record, 'topic');
  return nested && typeof nested === 'object' ? object(nested) : undefined;
}

export function author(item: Value): string {
  return (
    text(pick(object(pick(item, 'owner')), 'name')) ||
    text(pick(object(pick(object(pick(item, 'talk')), 'owner')), 'name')) ||
    text(pick(object(pick(object(pick(item, 'question')), 'owner')), 'name')) ||
    text(pick(object(pick(object(pick(item, 'answer')), 'owner')), 'name')) ||
    text(pick(object(pick(object(pick(item, 'task')), 'owner')), 'name')) ||
    text(pick(object(pick(object(pick(item, 'solution')), 'owner')), 'name'))
  );
}

export function content(item: Value): string {
  for (const key of ['talk', 'question', 'answer', 'task', 'solution']) {
    const value = text(pick(object(pick(item, key)), 'text'));
    if (value) return value;
  }
  return '';
}

export function title(item: Value): string {
  return text(pick(item, 'title')) || content(item);
}

export function preview(rows: Value[], limit = 3): string {
  return rows
    .slice(0, limit)
    .map(item => {
      const owner = text(pick(object(pick(item, 'owner')), 'name')) || '匿名';
      const repliee = text(pick(object(pick(item, 'repliee')), 'name'));
      return `${owner}${repliee ? ` -> ${repliee}` : ''}: ${text(pick(item, 'text'))}`;
    })
    .join(' | ');
}

export function topicRow(item: Value) {
  const id = pick(item, 'topic_id') ?? '';
  const shown = firstArray(pick(item, 'show_comments'), pick(item, 'comments'));
  return {
    topic_id: id,
    type: text(pick(item, 'type')),
    group: text(pick(object(pick(item, 'group')), 'name')),
    author: author(item),
    title: title(item),
    content: content(item),
    comments: pick(item, 'comments_count') ?? shown.length,
    likes: pick(item, 'likes_count') ?? 0,
    readers: pick(item, 'readers_count') ?? pick(item, 'reading_count') ?? 0,
    time: text(pick(item, 'create_time')),
    comment_preview: preview(shown),
    url: id ? `https://wx.zsxq.com/topic/${text(id)}` : 'https://wx.zsxq.com',
  };
}

export function explicitGroupId(value: unknown): string {
  const groupId = text(value);
  if (!groupId)
    throw new Error(
      'zsxq group-id is required because fetch adapters cannot read the active group from localStorage',
    );
  return groupId;
}
