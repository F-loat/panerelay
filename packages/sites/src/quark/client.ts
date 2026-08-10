import type { SiteCommandContext } from '@panerelay/site-kit';

export type JsonObject = Record<string, unknown>;

export function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function pick(value: unknown, key: string): unknown {
  return object(value)[key];
}

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`quark ${name} is required`);
  return result;
}

export function bounded(value: unknown, fallback: number, maximum: number): number {
  const parsed = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new Error(`quark depth must be between 0 and ${maximum}`);
  }
  return parsed;
}

export function flag(value: unknown): boolean {
  return value === true || text(value).toLowerCase() === 'true';
}

export function confirm(args: JsonObject): void {
  if (!flag(args.execute)) throw new Error('quark write requires --execute');
}

export function fidList(value: unknown): string[] {
  const result = [
    ...new Set(
      required(value, 'fids')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean),
    ),
  ];
  if (!result.length) throw new Error('quark fids must contain at least one file ID');
  if (result.length > 200) throw new Error('quark accepts at most 200 file IDs per command');
  return result;
}

export function extractPwdId(value: unknown): string {
  const input = required(value, 'url');
  const match = input.match(/\/s\/([A-Za-z0-9]+)/);
  if (match?.[1]) return match[1];
  if (/^[A-Za-z0-9]+$/.test(input)) return input;
  throw new Error('quark url must be a Quark share URL or pwd_id');
}

export function formatSize(value: unknown): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`;
}

export function formatDate(value: unknown): string {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const milliseconds = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().replace('T', ' ').slice(0, 19);
}

export class QuarkClient {
  readonly #context: SiteCommandContext;

  constructor(context: SiteCommandContext) {
    this.#context = context;
  }

  async request(
    url: string,
    method: 'GET' | 'POST' = 'GET',
    body?: JsonObject,
  ): Promise<JsonObject> {
    const response = await this.#context.fetch({
      url,
      method,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
        referer: 'https://pan.quark.cn/',
      },
      ...(body ? { body: { encoding: 'utf8' as const, data: JSON.stringify(body) } } : {}),
      responseType: 'json',
      withCookies: true,
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error('quark requires a valid logged-in browser session');
    }
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json') {
      throw new Error(`quark request failed: HTTP ${response.status}`);
    }
    const envelope = object(response.body);
    const status = Number(pick(envelope, 'status'));
    const success = pick(envelope, 'success');
    const message = text(pick(envelope, 'message') ?? pick(envelope, 'msg'));
    if (
      status === 401 ||
      status === 403 ||
      /未登录|请先登录|login|unauthorized|forbidden/i.test(message)
    ) {
      throw new Error('quark requires a valid logged-in browser session');
    }
    if (success !== true && status !== 200)
      throw new Error(
        message ||
          `quark API returned status ${status || text(pick(envelope, 'code')) || 'unknown'}`,
      );
    return envelope;
  }

  async get(url: string): Promise<JsonObject> {
    return object(pick(await this.request(url), 'data'));
  }

  async post(url: string, body: JsonObject): Promise<JsonObject> {
    return object(pick(await this.request(url, 'POST', body), 'data'));
  }

  async account(): Promise<JsonObject> {
    const data = await this.get('https://pan.quark.cn/account/info?fr=pc&platform=pc');
    if (!Object.keys(data).length)
      throw new Error('quark requires a valid logged-in browser session');
    return data;
  }

  async listDrive(parentFid: string): Promise<JsonObject[]> {
    const rows: JsonObject[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const envelope = await this.request(
        `https://drive-pc.quark.cn/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=${encodeURIComponent(parentFid)}&_page=${page}&_size=200&_fetch_total=1&_sort=file_type%3Aasc%2Cfile_name%3Aasc`,
      );
      const data = object(pick(envelope, 'data'));
      const list = pick(data, 'list');
      const pageRows = (Array.isArray(list) ? list : []).map(object);
      rows.push(...pageRows);
      const total = Number(pick(pick(envelope, 'metadata'), '_total'));
      if (!pageRows.length || !Number.isFinite(total) || rows.length >= total) return rows;
    }
    throw new Error('quark drive listing exceeded the 10,000-item safety limit');
  }

  async findFolder(path: string): Promise<string> {
    let current = '0';
    for (const part of path
      .split('/')
      .map(item => item.trim())
      .filter(Boolean)) {
      const entry = (await this.listDrive(current)).find(
        item => flag(pick(item, 'dir')) && text(pick(item, 'file_name')) === part,
      );
      const fid = text(pick(entry, 'fid'));
      if (!fid) throw new Error(`quark folder not found: ${part}`);
      current = fid;
    }
    return current;
  }

  async shareToken(pwdId: string, passcode: string): Promise<string> {
    const data = await this.post(
      'https://drive-h.quark.cn/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc',
      { pwd_id: pwdId, passcode, support_visit_limit_private_share: true },
    );
    return required(pick(data, 'stoken'), 'share token');
  }

  async listShare(pwdId: string, stoken: string, parentFid: string): Promise<JsonObject[]> {
    const rows: JsonObject[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const envelope = await this.request(
        `https://drive-h.quark.cn/1/clouddrive/share/sharepage/detail?pr=ucpro&fr=pc&ver=2&pwd_id=${encodeURIComponent(pwdId)}&stoken=${encodeURIComponent(stoken)}&pdir_fid=${encodeURIComponent(parentFid)}&force=0&_page=${page}&_size=200&_fetch_total=1&_sort=file_type%3Aasc%2Cfile_name%3Aasc`,
      );
      const data = object(pick(envelope, 'data'));
      const list = pick(data, 'list');
      const pageRows = (Array.isArray(list) ? list : []).map(object);
      rows.push(...pageRows);
      const total = Number(pick(pick(envelope, 'metadata'), '_total'));
      if (!pageRows.length || !Number.isFinite(total) || rows.length >= total) return rows;
    }
    throw new Error('quark share listing exceeded the 10,000-item safety limit');
  }

  async waitForTask(taskId: string, attempts: number): Promise<JsonObject> {
    for (let index = 0; index < attempts; index += 1) {
      const task = await this.get(
        `https://drive-pc.quark.cn/1/clouddrive/task?pr=ucpro&fr=pc&task_id=${encodeURIComponent(taskId)}&retry_index=0`,
      );
      if (Number(pick(task, 'status')) === 2) return task;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('quark task timed out');
  }
}
