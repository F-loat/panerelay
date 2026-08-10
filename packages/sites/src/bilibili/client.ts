import {
  type BrowserFetchRequest,
  type BrowserFetchResponse,
  type FetchAdapterInvocationRequest,
  type SiteCommandContext,
} from '@panerelay/site-kit';
import { imageKey, signWbiQuery } from './commands/_shared/wbi.js';

export const API_ORIGIN = 'https://api.bilibili.com';
export const SITE_ORIGIN = 'https://www.bilibili.com';
export const MAX_LIMIT = 100;

export type JsonObject = Record<string, unknown>;
export type AdapterArgs = Record<string, string | number | boolean>;

export interface BilibiliAdapterDependencies {
  browserFetch?: (
    request: BrowserFetchRequest,
    invocation: FetchAdapterInvocationRequest,
  ) => Promise<BrowserFetchResponse>;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function objectValue(value: unknown, label: string): JsonObject {
  if (!isObject(value)) throw new Error(`Bilibili ${label} is malformed`);
  return value;
}

export function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Bilibili ${label} is malformed`);
  return value;
}

export function stringValue(value: unknown): string {
  return value == null ? '' : String(value);
}

export function finiteNumber(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Bilibili ${label} is malformed`);
  return number;
}

export function positiveInteger(
  value: unknown,
  label: string,
  defaultValue?: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const selected = value == null || value === '' ? defaultValue : Number(value);
  if (
    selected === undefined ||
    !Number.isSafeInteger(selected) ||
    selected < 1 ||
    selected > maximum
  ) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  }
  return selected;
}

export function optionalPositiveInteger(value: unknown, label: string): number | undefined {
  if (value == null || value === '') return undefined;
  return positiveInteger(value, label);
}

export function requiredString(args: AdapterArgs, name: string): string {
  const value = stringValue(args[name]).trim();
  if (!value) throw new Error(`Bilibili ${name} is required`);
  return value;
}

export function optionalString(args: AdapterArgs, name: string): string | undefined {
  const value = stringValue(args[name]).trim();
  return value || undefined;
}

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .trim();
}

export function bilibiliJumpUrl(value: unknown): string {
  const url = stringValue(value).trim();
  return url.startsWith('//') ? `https:${url}` : url;
}

function apiError(payload: JsonObject, label: string): Error | undefined {
  if (payload.code === 0) return undefined;
  const code = String(payload.code ?? 'malformed');
  const message = stringValue(payload.message || 'unknown error');
  const auth =
    ['-101', '-111', '-403'].includes(code) || /csrf|登录|权限|login|forbidden/i.test(message);
  return new Error(
    auth
      ? `Bilibili ${label} requires a valid logged-in session: ${message} (${code})`
      : `Bilibili ${label} API failed: ${message} (${code})`,
  );
}

export function payloadData(payload: unknown, label: string): unknown {
  const object = objectValue(payload, `${label} response`);
  const error = apiError(object, label);
  if (error) throw error;
  return object.data;
}

function responseJson(response: BrowserFetchResponse, label: string): unknown {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Bilibili ${label} request returned HTTP ${response.status}`);
  }
  if (response.bodyType !== 'json') throw new Error(`Bilibili ${label} response is not JSON`);
  return response.body;
}

const BILIBILI_TEST_DEPENDENCIES = Symbol('bilibili-test-dependencies');

type BilibiliCommandContext = SiteCommandContext & {
  [BILIBILI_TEST_DEPENDENCIES]?: BilibiliAdapterDependencies;
};

export function createBilibiliTestContext(
  invocation: FetchAdapterInvocationRequest,
  dependencies: BilibiliAdapterDependencies,
): SiteCommandContext {
  const browserFetch = dependencies.browserFetch;
  if (!browserFetch) throw new Error('Bilibili test context requires browserFetch');
  return {
    invocation,
    fetch: request => browserFetch(request, invocation),
    [BILIBILI_TEST_DEPENDENCIES]: dependencies,
  } as BilibiliCommandContext;
}

export class BilibiliClient {
  readonly #fetch: NonNullable<BilibiliAdapterDependencies['browserFetch']>;
  readonly #invocation: FetchAdapterInvocationRequest;
  readonly #now: () => number;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  #nav?: JsonObject;

  constructor(context: SiteCommandContext) {
    const dependencies = (context as BilibiliCommandContext)[BILIBILI_TEST_DEPENDENCIES] ?? {};
    this.#invocation = context.invocation;
    this.#fetch =
      dependencies.browserFetch ?? ((request: BrowserFetchRequest) => context.fetch(request));
    this.#now = dependencies.now ?? Date.now;
    this.#sleep =
      dependencies.sleep ??
      (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  }

  async request(request: BrowserFetchRequest, label: string): Promise<unknown> {
    return responseJson(await this.#fetch(request, this.#invocation), label);
  }

  async getUrl(url: string, label: string, withCookies = true): Promise<unknown> {
    return this.request(
      {
        url,
        headers: { Origin: SITE_ORIGIN, Referer: `${SITE_ORIGIN}/` },
        responseType: 'json',
        withCookies,
      },
      label,
    );
  }

  async api(
    path: string,
    params: Record<string, string | number> = {},
    signed = false,
  ): Promise<unknown> {
    let query = Object.fromEntries(
      Object.entries(params).map(([name, value]) => [name, String(value)]),
    );
    if (signed) {
      const nav = await this.nav();
      const wbi = objectValue(nav.wbi_img, 'nav WBI');
      query = signWbiQuery(
        query,
        imageKey(wbi.img_url, 'WBI image URL'),
        imageKey(wbi.sub_url, 'WBI sub-image URL'),
        Math.floor(this.#now() / 1_000),
      );
    }
    return this.request(
      {
        url: `${API_ORIGIN}${path}`,
        headers: { Origin: SITE_ORIGIN, Referer: `${SITE_ORIGIN}/` },
        query: Object.entries(query).map(([name, value]) => ({ name, value })),
        responseType: 'json',
        withCookies: true,
      },
      path,
    );
  }

  async data(
    path: string,
    params: Record<string, string | number> = {},
    signed = false,
  ): Promise<unknown> {
    return payloadData(await this.api(path, params, signed), path);
  }

  async post(path: string, params: Record<string, string | number>): Promise<unknown> {
    const body = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([name, value]) => [name, String(value)])),
    ).toString();
    const payload = await this.request(
      {
        url: `${API_ORIGIN}${path}`,
        method: 'POST',
        headers: {
          Origin: SITE_ORIGIN,
          Referer: `${SITE_ORIGIN}/`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: { encoding: 'utf8', data: body },
        bindings: ['bilibili-csrf'],
        responseType: 'json',
        withCookies: true,
      },
      path,
    );
    return payloadData(payload, path);
  }

  async nav(): Promise<JsonObject> {
    if (!this.#nav) {
      this.#nav = objectValue(await this.data('/x/web-interface/nav'), 'nav data');
    }
    return this.#nav;
  }

  async selfUid(): Promise<string> {
    const uid = stringValue((await this.nav()).mid);
    if (!/^[1-9]\d*$/.test(uid)) throw new Error('Bilibili login is required');
    return uid;
  }

  async resolveBvid(input: string): Promise<string> {
    const value = input.trim();
    if (/^BV[A-Za-z0-9]+$/i.test(value)) return value;
    try {
      const url = new URL(value);
      if (/(^|\.)bilibili\.com$/i.test(url.hostname)) {
        const match = url.pathname.match(/\/(?:video|bangumi\/play)\/(BV[A-Za-z0-9]+)/i);
        if (match?.[1]) return match[1];
        throw new Error('Bilibili URL does not contain a BV ID');
      }
      if (!/(^|\.)b23\.tv$/i.test(url.hostname)) {
        throw new Error('Video URL must use bilibili.com or b23.tv');
      }
    } catch (error) {
      if (/^https?:\/\//i.test(value)) throw error;
    }
    const shortCode = value.replace(/^https?:\/\//i, '').replace(/^(?:www\.)?b23\.tv\//i, '');
    if (!/^[A-Za-z0-9]+$/.test(shortCode)) throw new Error(`Invalid Bilibili video: ${value}`);
    const response = await this.#fetch(
      {
        url: `https://b23.tv/${shortCode}`,
        responseType: 'text',
        withCookies: false,
      },
      this.#invocation,
    );
    const match = response.url.match(/\/(?:video|bangumi\/play)\/(BV[A-Za-z0-9]+)/i);
    if (!match?.[1]) throw new Error(`Cannot resolve Bilibili short URL: ${value}`);
    return match[1];
  }

  async resolveUid(input: string): Promise<string> {
    const value = input.trim();
    if (/^[1-9]\d*$/.test(value)) return value;
    const space = value.match(/^(?:https?:\/\/)?space\.bilibili\.com\/([1-9]\d*)\/?$/i);
    if (space?.[1]) return space[1];
    if (/space\.bilibili\.com/i.test(value)) throw new Error('Invalid Bilibili space URL');
    const data = objectValue(
      await this.data(
        '/x/web-interface/wbi/search/type',
        { search_type: 'bili_user', keyword: value },
        true,
      ),
      'user search data',
    );
    const results = arrayValue(data.result, 'user search result');
    const uid = stringValue(objectValue(results[0], 'user search item').mid);
    if (!/^[1-9]\d*$/.test(uid)) throw new Error(`No Bilibili user found: ${value}`);
    return uid;
  }

  async relation(mid: string): Promise<number> {
    const data = objectValue(
      payloadData(
        await this.getUrl(`${API_ORIGIN}/x/relation?fid=${encodeURIComponent(mid)}`, 'relation'),
        'relation',
      ),
      'relation data',
    );
    return finiteNumber(data.attribute, 'relation attribute');
  }

  async waitForRelation(mid: string, predicate: (attribute: number) => boolean): Promise<number> {
    let attribute = await this.relation(mid);
    for (let attempt = 0; attempt < 10 && !predicate(attribute); attempt += 1) {
      await this.#sleep(500);
      attribute = await this.relation(mid);
    }
    if (!predicate(attribute))
      throw new Error(`Bilibili relation verification failed: ${attribute}`);
    return attribute;
  }
}
