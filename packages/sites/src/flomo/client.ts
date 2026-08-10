import { SiteError, type SiteCommandContext } from '@panerelay/site-kit';

type JsonObject = Record<string, unknown>;

const SIGNING_SUFFIX = 'dbbc3dd73364b4084c3a69346e0ce2b2';
const SHIFT = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
] as const;
const TABLE = Array.from({ length: 64 }, (_, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 0x1_0000_0000),
);

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function littleEndianHex(value: number): string {
  return [0, 8, 16, 24]
    .map(shift => ((value >>> shift) & 0xff).toString(16).padStart(2, '0'))
    .join('');
}

export function md5(value: string): string {
  const input = new TextEncoder().encode(value);
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const bitLength = BigInt(input.length) * 8n;
  for (let index = 0; index < 8; index += 1) {
    bytes[paddedLength - 8 + index] = Number((bitLength >> BigInt(index * 8)) & 0xffn);
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) => {
      const start = offset + index * 4;
      return (
        (bytes[start]! |
          (bytes[start + 1]! << 8) |
          (bytes[start + 2]! << 16) |
          (bytes[start + 3]! << 24)) >>>
        0
      );
    });
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let index = 0; index < 64; index += 1) {
      let f: number;
      let word: number;
      if (index < 16) {
        f = (b & c) | (~b & d);
        word = index;
      } else if (index < 32) {
        f = (d & b) | (~d & c);
        word = (5 * index + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        word = (3 * index + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        word = (7 * index) % 16;
      }
      const previousD = d;
      d = c;
      c = b;
      b = (b + rotateLeft((a + f + TABLE[index]! + words[word]!) >>> 0, SHIFT[index]!)) >>> 0;
      a = previousD;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].map(littleEndianHex).join('');
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function positiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const raw = String(value).trim();
  const parsed = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new SiteError('invalid-input', `flomo ${name} must be between 1 and ${maximum}`);
  }
  return parsed;
}

export function since(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const raw = String(value).trim();
  const parsed = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(parsed)) {
    throw new SiteError('invalid-input', 'flomo since must be a non-negative Unix timestamp');
  }
  return parsed;
}

export function cursor(value: unknown): string {
  const result = text(value);
  if (result && !/^[A-Za-z0-9_-]{1,256}$/.test(result)) {
    throw new SiteError('invalid-input', 'flomo slug is not a valid memo cursor');
  }
  return result;
}

export function signedUrl(
  limit: number,
  latestUpdatedAt: number,
  slug: string,
  timestamp = Math.floor(Date.now() / 1_000),
): string {
  const params: Record<string, string> = {
    limit: String(limit),
    latest_updated_at: String(latestUpdatedAt),
    tz: '8:0',
    timestamp: String(timestamp),
    api_key: 'flomo_web',
    app_version: '4.0',
    platform: 'web',
    webp: '1',
    ...(slug ? { latest_slug: slug } : {}),
  };
  const base = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  params.sign = md5(`${base}${SIGNING_SUFFIX}`);
  return `https://flomoapp.com/api/v1/memo/updated/?${new URLSearchParams(params)}`;
}

function joinedValues(value: unknown, keys: string[]): string {
  if (!Array.isArray(value)) return '';
  return value
    .map(item => {
      if (typeof item === 'string') return item;
      const candidate = object(item);
      return keys.map(key => text(candidate[key])).find(Boolean) ?? '';
    })
    .filter(Boolean)
    .join(keys[0] === 'thumbnail_url' ? ' | ' : ', ');
}

export function memoRow(value: unknown): Record<string, unknown> {
  const memo = object(value);
  const slug = text(memo.slug ?? memo.id);
  if (!slug) throw new SiteError('shape-drift', 'Flomo returned a memo without slug/id');
  return {
    id: slug,
    url: `https://v.flomoapp.com/mine/?memo_id=${encodeURIComponent(slug)}`,
    content: text(memo.content),
    slug,
    tags: joinedValues(memo.tags, ['name', 'tag', 'content']),
    images: joinedValues(memo.files, ['thumbnail_url', 'url']),
    created_at: text(memo.created_at),
    updated_at: text(memo.updated_at),
  };
}

export async function fetchMemos(
  context: SiteCommandContext,
  input: { limit: number; since: number; slug: string },
): Promise<Record<string, unknown>[]> {
  const response = await context.fetch({
    url: signedUrl(input.limit, input.since, input.slug),
    headers: { accept: 'application/json' },
    bindings: ['flomo-access-token'],
    responseType: 'json',
    withCookies: true,
  });
  if (response.status === 401 || response.status === 403) {
    throw new SiteError('auth-required', 'Flomo requires an active signed-in browser session');
  }
  if (response.status < 200 || response.status >= 300) {
    throw new SiteError('upstream-failure', `Flomo API returned HTTP ${response.status}`);
  }
  if (response.bodyType !== 'json') throw new SiteError('shape-drift', 'Flomo returned non-JSON');
  const body = object(response.body);
  if (Number(body.code) !== 0) {
    const message = text(body.message) || `Flomo API error ${text(body.code)}`;
    if (/auth|login|token|permission|forbidden|unauthorized|登录|登陆|鉴权|权限/i.test(message)) {
      throw new SiteError('auth-required', message);
    }
    throw new SiteError('upstream-failure', message);
  }
  if (!Array.isArray(body.data)) throw new SiteError('shape-drift', 'Flomo memo data is malformed');
  if (body.data.length === 0) throw new SiteError('empty-result', 'No Flomo memos matched');
  return body.data.map(memoRow);
}
