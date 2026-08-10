import { createHash } from 'node:crypto';
import {
  PANERELAY_FETCH_MAX_BODY_BYTES,
  SITE_ERROR_CODES,
  type BrowserFetchBody,
  type BrowserFetchRequest,
  type BrowserFetchResponse,
  type SiteErrorCode,
} from '@panerelay/protocol';
import type { SiteArtifact, SiteCommandContext } from './definitions.js';

const MAX_SITE_ERROR_BYTES = 4_096;
const MAX_MULTIPART_FIELDS = 64;
const MAX_MULTIPART_FIELD_BYTES = 64 * 1024;

function boundedUtf8(value: string, maximumBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(value).length <= maximumBytes) return value;
  let result = '';
  let length = 0;
  for (const character of value) {
    const bytes = encoder.encode(character).length;
    if (length + bytes > maximumBytes) break;
    result += character;
    length += bytes;
  }
  return result;
}

export class SiteError extends Error {
  readonly code: SiteErrorCode;
  readonly retryable?: boolean;

  constructor(code: SiteErrorCode, message: string, retryable?: boolean) {
    if (!SITE_ERROR_CODES.includes(code)) throw new Error(`Unknown site error code: ${code}`);
    const bounded = boundedUtf8(message.trim(), MAX_SITE_ERROR_BYTES);
    super(bounded || 'Site command failed');
    this.name = 'SiteError';
    this.code = code;
    if (retryable !== undefined) this.retryable = retryable;
  }
}

export function decodeBase64Bytes(value: string): Uint8Array {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new SiteError('shape-drift', 'Browser response is not valid Base64');
  }
  try {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  } catch {
    throw new SiteError('shape-drift', 'Browser response is not valid Base64');
  }
}

export function decodeBase64Text(value: string, encoding = 'utf-8'): string {
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(decodeBase64Bytes(value));
  } catch (error) {
    if (error instanceof SiteError) throw error;
    throw new SiteError('unsupported', `Unsupported response encoding: ${encoding}`);
  }
}

export function responseBytes(response: BrowserFetchResponse): Uint8Array {
  if (response.bodyType !== 'base64' || typeof response.body !== 'string') {
    throw new SiteError('shape-drift', 'Browser response did not contain Base64 bytes');
  }
  return decodeBase64Bytes(response.body);
}

export function responseText(response: BrowserFetchResponse, encoding = 'utf-8'): string {
  if (response.bodyType === 'text' && typeof response.body === 'string' && encoding === 'utf-8') {
    return response.body;
  }
  return new TextDecoder(encoding, { fatal: false }).decode(responseBytes(response));
}

function assertSuccessful(response: BrowserFetchResponse): void {
  if (response.status === 401 || response.status === 403) {
    throw new SiteError('auth-required', 'Authentication is required for this command');
  }
  if (response.status === 429) {
    throw new SiteError('upstream-failure', 'The upstream service is rate limiting requests', true);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new SiteError('upstream-failure', `Upstream request failed with HTTP ${response.status}`);
  }
}

export async function fetchValidatedJson<T>(
  context: SiteCommandContext,
  request: BrowserFetchRequest,
  validate?: (value: unknown) => value is T,
): Promise<T> {
  const response = await context.fetch({ ...request, responseType: 'json' });
  assertSuccessful(response);
  if (response.bodyType !== 'json') {
    throw new SiteError('shape-drift', 'Upstream response was not JSON');
  }
  if (validate && !validate(response.body)) {
    throw new SiteError('shape-drift', 'Upstream JSON response has an unexpected shape');
  }
  return response.body as T;
}

export async function seedSameOriginPage(
  context: SiteCommandContext,
  url: string,
  options: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<BrowserFetchResponse> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new SiteError('invalid-input', 'Seed URL must be an absolute HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new SiteError('invalid-input', 'Seed URL must be an absolute HTTP(S) URL');
  }
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (!['origin', 'referer'].includes(name.toLowerCase()) || value === '') continue;
    let source: URL;
    try {
      source = new URL(value);
    } catch {
      throw new SiteError('invalid-input', `Seed ${name} header must be an absolute URL`);
    }
    if (source.origin !== target.origin) {
      throw new SiteError('invalid-input', `Seed ${name} header must be same-origin`);
    }
  }
  const response = await context.fetch({
    url: target.toString(),
    method: 'GET',
    headers: options.headers,
    responseType: 'text',
    withCookies: true,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
  assertSuccessful(response);
  return response;
}

export interface MultipartTextField {
  name: string;
  value: string;
}

export interface MultipartBody {
  contentType: string;
  body: BrowserFetchBody;
}

function multipartName(value: string, label: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(value)) {
    throw new SiteError('invalid-input', `${label} is invalid`);
  }
  return value;
}

function quotedFilename(value: string): string {
  if (!value || /[\r\n\p{Cc}]/u.test(value)) {
    throw new SiteError('invalid-input', 'Artifact filename is unsafe');
  }
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export function createMultipartBody(
  fileField: string,
  artifact: SiteArtifact,
  fields: readonly MultipartTextField[] = [],
): MultipartBody {
  const normalizedFileField = multipartName(fileField, 'Multipart file field');
  if (fields.length > MAX_MULTIPART_FIELDS) {
    throw new SiteError('invalid-input', 'Multipart request has too many text fields');
  }
  const names = new Set<string>([normalizedFileField]);
  for (const field of fields) {
    multipartName(field.name, 'Multipart field name');
    if (names.has(field.name)) {
      throw new SiteError('invalid-input', `Duplicate multipart field: ${field.name}`);
    }
    if (Buffer.byteLength(field.value, 'utf8') > MAX_MULTIPART_FIELD_BYTES) {
      throw new SiteError('invalid-input', `Multipart field ${field.name} is too large`);
    }
    names.add(field.name);
  }
  if (artifact.bytes.length !== artifact.size) {
    throw new SiteError('invalid-input', 'Artifact size does not match its bytes');
  }
  const digest = createHash('sha256')
    .update(artifact.bytes)
    .update(JSON.stringify(fields))
    .digest('hex')
    .slice(0, 32);
  const boundary = `panerelay-${digest}`;
  const chunks: Buffer[] = [];
  for (const field of fields) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`,
        'utf8',
      ),
    );
  }
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${normalizedFileField}"; filename="${quotedFilename(artifact.basename)}"\r\nContent-Type: ${artifact.mediaType}\r\n\r\n`,
      'utf8',
    ),
    Buffer.from(artifact.bytes),
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
  );
  const value = Buffer.concat(chunks);
  if (value.length > PANERELAY_FETCH_MAX_BODY_BYTES) {
    throw new SiteError('invalid-input', 'Multipart request exceeds the 16 MiB body limit');
  }
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: { encoding: 'base64', data: value.toString('base64') },
  };
}
