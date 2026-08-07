import {
  PANERELAY_FETCH_DEFAULT_TIMEOUT_MS,
  PANERELAY_FETCH_MAX_BODY_BYTES,
  PANERELAY_FETCH_MAX_RESPONSE_BODY_BYTES,
  type BrowserFetchCookieBinding,
  type BrowserFetchRequest,
  type BrowserFetchResponse,
} from '@panerelay/protocol';

const FETCH_RULE_ID_START = 850_000;
const FETCH_RULE_ID_END = 859_999;
const MANAGED_HEADER_NAMES = new Set(['cookie', 'origin', 'referer']);

export interface BrowserCookie {
  name: string;
  value: string;
  path?: string;
}

export interface BrowserFetchHeaderOperation {
  header: 'Cookie' | 'Origin' | 'Referer';
  operation: 'set' | 'remove';
  value?: string;
}

export interface BrowserFetchEnvironment {
  cookiesForUrl(url: string): Promise<BrowserCookie[]>;
  fetch(input: string, init: RequestInit): Promise<Response>;
  installHeaderRule(
    ruleId: number,
    url: string,
    operations: BrowserFetchHeaderOperation[],
  ): Promise<void>;
  removeHeaderRule(ruleId: number): Promise<void>;
}

const activeRuleIds = new Set<number>();
const urlQueues = new Map<string, Promise<unknown>>();
let nextRuleId = FETCH_RULE_ID_START;

function allocateRuleId(): number {
  for (let attempts = 0; attempts <= FETCH_RULE_ID_END - FETCH_RULE_ID_START; attempts += 1) {
    const candidate = nextRuleId;
    nextRuleId = candidate >= FETCH_RULE_ID_END ? FETCH_RULE_ID_START : candidate + 1;
    if (!activeRuleIds.has(candidate)) {
      activeRuleIds.add(candidate);
      return candidate;
    }
  }
  throw new Error('Too many concurrent browser fetch header rules');
}

function releaseRuleId(ruleId: number): void {
  activeRuleIds.delete(ruleId);
}

function serializeUrl<T>(url: string, operation: () => Promise<T>): Promise<T> {
  const previous = urlQueues.get(url) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  urlQueues.set(url, current);
  return current.finally(() => {
    if (urlQueues.get(url) === current) urlQueues.delete(url);
  });
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
  return result;
}

function encodeBase64(value: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < value.length; offset += 32_768) {
    binary += String.fromCharCode(...value.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

function requestedHeader(
  headers: Record<string, string> | undefined,
  expectedName: string,
): string | undefined {
  let result: string | undefined;
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (name.toLowerCase() === expectedName) result = value;
  }
  return result;
}

function directHeaders(source: Record<string, string> | undefined): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(source ?? {})) {
    if (!MANAGED_HEADER_NAMES.has(name.toLowerCase())) result.set(name, value);
  }
  return result;
}

function appendQuery(url: URL, request: BrowserFetchRequest): void {
  for (const entry of request.query ?? []) url.searchParams.append(entry.name, entry.value);
}

function sourceHeaderOperation(
  header: 'Origin' | 'Referer',
  explicitValue: string | undefined,
  generatedValue: string,
): BrowserFetchHeaderOperation {
  const value = explicitValue ?? generatedValue;
  return value === '' ? { header, operation: 'remove' } : { header, operation: 'set', value };
}

function cookieHeader(cookies: BrowserCookie[]): string {
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

function orderedCookies(cookies: BrowserCookie[]): BrowserCookie[] {
  return [...cookies].sort((left, right) => (right.path?.length ?? 0) - (left.path?.length ?? 0));
}

interface ResolvedCookieBinding {
  binding: BrowserFetchCookieBinding;
  sourceValue: string;
  value: string;
}

function resolveCookieBindings(
  bindings: BrowserFetchCookieBinding[] | undefined,
  cookies: BrowserCookie[],
): ResolvedCookieBinding[] {
  const result: ResolvedCookieBinding[] = [];
  for (const binding of bindings ?? []) {
    const cookie = cookies.find(candidate => candidate.name === binding.cookieName);
    if (!cookie) {
      if (binding.required !== false) {
        throw new Error(`Required browser Cookie is missing: ${binding.cookieName}`);
      }
      continue;
    }
    let value = cookie.value;
    if (binding.transform === 'url-decode') {
      try {
        value = decodeURIComponent(value);
      } catch {
        throw new Error(`Browser Cookie URL decoding failed: ${binding.cookieName}`);
      }
    }
    result.push({ binding, sourceValue: cookie.value, value });
  }
  return result;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function preparedRequest(
  request: BrowserFetchRequest,
  bindings: ResolvedCookieBinding[],
): { body: BodyInit | undefined; headers: Headers } {
  const headers = directHeaders(request.headers);
  const bodyBindingKind = bindings.find(
    binding =>
      binding.binding.destination.kind === 'form' || binding.binding.destination.kind === 'json',
  )?.binding.destination.kind;
  let body: BodyInit | undefined;
  if (bodyBindingKind === 'form') {
    const form = new URLSearchParams(request.body?.data ?? '');
    for (const { binding, value } of bindings) {
      if (binding.destination.kind === 'form') form.set(binding.destination.name, value);
    }
    const serialized = form.toString();
    if (utf8Bytes(serialized) > PANERELAY_FETCH_MAX_BODY_BYTES) {
      throw new Error('Browser fetch body exceeds the limit after Cookie binding');
    }
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    body = serialized;
  } else if (bodyBindingKind === 'json') {
    let value: unknown = {};
    if (request.body?.data) {
      try {
        value = JSON.parse(request.body.data) as unknown;
      } catch {
        throw new Error('Browser fetch JSON body is invalid for Cookie binding');
      }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Browser fetch JSON body must be an object for Cookie binding');
    }
    const object = value as Record<string, unknown>;
    for (const { binding, value: cookieValue } of bindings) {
      if (binding.destination.kind === 'json') {
        object[binding.destination.name] = cookieValue;
      }
    }
    const serialized = JSON.stringify(object);
    if (utf8Bytes(serialized) > PANERELAY_FETCH_MAX_BODY_BYTES) {
      throw new Error('Browser fetch body exceeds the limit after Cookie binding');
    }
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = serialized;
  } else {
    body = requestBody(request);
  }
  for (const { binding, value } of bindings) {
    if (binding.destination.kind === 'header') headers.set(binding.destination.name, value);
  }
  return { body, headers };
}

function redactString(value: string, secrets: string[]): string {
  let result = value;
  for (const secret of secrets) {
    if (secret) result = result.replaceAll(secret, '[redacted]');
  }
  return result;
}

function redactBytes(value: Uint8Array, secrets: string[]): Uint8Array {
  let result = value;
  const encoder = new TextEncoder();
  const replacement = encoder.encode('[redacted]');
  for (const secret of secrets) {
    const pattern = encoder.encode(secret);
    if (pattern.length === 0 || pattern.length > result.length) continue;
    const starts: number[] = [];
    for (let offset = 0; offset <= result.length - pattern.length;) {
      let matches = true;
      for (let index = 0; index < pattern.length; index += 1) {
        if (result[offset + index] !== pattern[index]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        starts.push(offset);
        offset += pattern.length;
      } else {
        offset += 1;
      }
    }
    if (starts.length === 0) continue;
    const next = new Uint8Array(
      result.length + starts.length * (replacement.length - pattern.length),
    );
    let sourceOffset = 0;
    let targetOffset = 0;
    for (const start of starts) {
      next.set(result.subarray(sourceOffset, start), targetOffset);
      targetOffset += start - sourceOffset;
      next.set(replacement, targetOffset);
      targetOffset += replacement.length;
      sourceOffset = start + pattern.length;
    }
    next.set(result.subarray(sourceOffset), targetOffset);
    result = next;
  }
  return result;
}

function sanitizedError(error: unknown, secrets: string[]): Error {
  const detail = redactString(error instanceof Error ? error.message : String(error), secrets);
  return new Error(detail || 'Browser fetch failed');
}

async function readBoundedBody(response: Response): Promise<Uint8Array> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > PANERELAY_FETCH_MAX_RESPONSE_BODY_BYTES) {
    throw new Error(
      `Browser fetch response exceeds ${PANERELAY_FETCH_MAX_RESPONSE_BODY_BYTES} bytes`,
    );
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.length;
    if (length > PANERELAY_FETCH_MAX_RESPONSE_BODY_BYTES) {
      await reader.cancel('Panerelay browser fetch response limit exceeded').catch(() => undefined);
      throw new Error(
        `Browser fetch response exceeds ${PANERELAY_FETCH_MAX_RESPONSE_BODY_BYTES} bytes`,
      );
    }
    chunks.push(next.value);
  }

  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function looksBinary(contentType: string): boolean {
  if (!contentType) return false;
  return !(
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType.includes('javascript') ||
    contentType.includes('x-www-form-urlencoded')
  );
}

function decodeResponseBody(
  bytes: Uint8Array,
  contentType: string,
  requestedType: BrowserFetchRequest['responseType'],
): Pick<BrowserFetchResponse, 'body' | 'bodyType'> {
  if (requestedType === 'base64' || (requestedType === 'auto' && looksBinary(contentType))) {
    return { body: encodeBase64(bytes), bodyType: 'base64' };
  }

  const text = new TextDecoder().decode(bytes);
  if (requestedType === 'json' || (requestedType === 'auto' && contentType.includes('json'))) {
    try {
      return { body: text.length === 0 ? null : JSON.parse(text), bodyType: 'json' };
    } catch {
      throw new Error('Browser fetch response is not valid JSON');
    }
  }
  return { body: text, bodyType: 'text' };
}

function requestBody(request: BrowserFetchRequest): BodyInit | undefined {
  if (!request.body) return undefined;
  if (request.body.encoding === 'utf8') return request.body.data;
  const decoded = decodeBase64(request.body.data);
  const buffer = new ArrayBuffer(decoded.length);
  new Uint8Array(buffer).set(decoded);
  return buffer;
}

function siteAccessFailure(url: URL, phase: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(
    `Browser fetch ${phase} failed for ${url.origin}: ${detail}. ` +
      `If Chrome has not granted Panerelay access to this site, grant site access and retry.`,
  );
}

async function executeSerialized(
  request: BrowserFetchRequest,
  target: URL,
  environment: BrowserFetchEnvironment,
): Promise<BrowserFetchResponse> {
  const targetUrl = target.toString();
  let cookies: BrowserCookie[] = [];
  if (request.withCookies !== false || (request.cookieBindings?.length ?? 0) > 0) {
    try {
      cookies = await environment.cookiesForUrl(targetUrl);
    } catch (error) {
      throw siteAccessFailure(target, 'cookie access', error);
    }
  }
  cookies = orderedCookies(cookies);
  let bindings: ResolvedCookieBinding[] = [];
  try {
    bindings = resolveCookieBindings(request.cookieBindings, cookies);
  } catch (error) {
    throw sanitizedError(
      error,
      bindings.map(binding => binding.value),
    );
  }
  const secrets = [
    ...new Set(bindings.flatMap(binding => [binding.sourceValue, binding.value]).filter(Boolean)),
  ];
  let prepared: ReturnType<typeof preparedRequest>;
  try {
    prepared = preparedRequest(request, bindings);
  } catch (error) {
    throw sanitizedError(error, secrets);
  }

  const operations: BrowserFetchHeaderOperation[] = [
    sourceHeaderOperation('Origin', requestedHeader(request.headers, 'origin'), target.origin),
    sourceHeaderOperation(
      'Referer',
      requestedHeader(request.headers, 'referer'),
      `${target.origin}/panerelay`,
    ),
  ];
  const attachedCookies = request.withCookies === false ? [] : cookies;
  const generatedCookie = cookieHeader(attachedCookies);
  if (generatedCookie) {
    operations.unshift({ header: 'Cookie', operation: 'set', value: generatedCookie });
  } else {
    operations.unshift({ header: 'Cookie', operation: 'remove' });
  }

  const ruleId = allocateRuleId();
  let installed = false;
  try {
    try {
      await environment.installHeaderRule(ruleId, targetUrl, operations);
      installed = true;
    } catch (error) {
      throw sanitizedError(siteAccessFailure(target, 'header setup', error), secrets);
    }

    const abort = new AbortController();
    const timeoutMs = request.timeoutMs ?? PANERELAY_FETCH_DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => abort.abort(), timeoutMs);
    let response: Response;
    try {
      response = await environment.fetch(targetUrl, {
        method: request.method ?? 'GET',
        headers: prepared.headers,
        body: prepared.body,
        credentials: 'omit',
        redirect: bindings.length > 0 ? 'error' : 'follow',
        signal: abort.signal,
      });
    } catch (error) {
      if (abort.signal.aborted) {
        throw new Error(`Browser fetch timed out after ${timeoutMs} ms`, { cause: error });
      }
      throw sanitizedError(siteAccessFailure(target, 'request', error), secrets);
    } finally {
      clearTimeout(timeout);
    }

    const bytes = redactBytes(await readBoundedBody(response), secrets);
    const decoded = decodeResponseBody(
      bytes,
      response.headers.get('content-type')?.toLowerCase() ?? '',
      request.responseType ?? 'auto',
    );
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      if (name !== 'set-cookie' && name !== 'set-cookie2') {
        headers[name] = redactString(value, secrets);
      }
    });
    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      ...decoded,
      url: response.url || targetUrl,
      redirected: response.redirected,
      attachedCookieCount: attachedCookies.length,
    };
  } finally {
    if (installed) await environment.removeHeaderRule(ruleId).catch(() => undefined);
    releaseRuleId(ruleId);
  }
}

export function executeBrowserFetch(
  request: BrowserFetchRequest,
  environment: BrowserFetchEnvironment,
): Promise<BrowserFetchResponse> {
  const target = new URL(request.url);
  target.hash = '';
  appendQuery(target, request);
  return serializeUrl(target.toString(), () => executeSerialized(request, target, environment));
}

function escapeDnrRegex(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

export function createChromeBrowserFetchEnvironment(): BrowserFetchEnvironment {
  return {
    cookiesForUrl: async url =>
      (await chrome.cookies.getAll({ url })).filter(cookie => cookie.partitionKey === undefined),
    fetch: (input, init) => fetch(input, init),
    installHeaderRule: async (ruleId, url, operations) => {
      const requestHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = operations.map(
        operation => ({
          header: operation.header,
          operation:
            operation.operation === 'set'
              ? chrome.declarativeNetRequest.HeaderOperation.SET
              : chrome.declarativeNetRequest.HeaderOperation.REMOVE,
          ...(operation.value === undefined ? {} : { value: operation.value }),
        }),
      );
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId],
        addRules: [
          {
            id: ruleId,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              requestHeaders,
            },
            condition: {
              regexFilter: `^${escapeDnrRegex(url)}$`,
              initiatorDomains: [chrome.runtime.id],
            },
          },
        ],
      });
    },
    removeHeaderRule: ruleId =>
      chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] }),
  };
}

export async function removeAbandonedBrowserFetchRules(): Promise<void> {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  const removeRuleIds = rules
    .map(rule => rule.id)
    .filter(ruleId => ruleId >= FETCH_RULE_ID_START && ruleId <= FETCH_RULE_ID_END);
  if (removeRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds });
  }
}
