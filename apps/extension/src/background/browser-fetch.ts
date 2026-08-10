import {
  PANERELAY_FETCH_DEFAULT_TIMEOUT_MS,
  PANERELAY_FETCH_MAX_BODY_BYTES,
  PANERELAY_FETCH_MAX_RESPONSE_BODY_BYTES,
  type BrowserFetchBindingPolicy,
  type BrowserFetchRequest,
  type BrowserFetchResponse,
} from '@panerelay/protocol';

const FETCH_RULE_ID_START = 850_000;
const FETCH_RULE_ID_END = 859_999;
const MANAGED_HEADER_NAMES = new Set(['cookie', 'origin', 'referer']);
const MIN_REDACTABLE_SECRET_BYTES = 8;
const MAX_BOUND_VALUE_BYTES = 64 * 1024;

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
  localStorageForOrigin(origin: string, key: string): Promise<string | null>;
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

interface ResolvedBinding {
  policy: BrowserFetchBindingPolicy;
  sourceValue: string;
  transformedValue: string;
  value: string;
}

function jsonPointer(value: unknown, pointer: string): unknown {
  if (pointer === '') return value;
  let current = value;
  for (const encoded of pointer.slice(1).split('/')) {
    const segment = encoded.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function decoratedValue(policy: BrowserFetchBindingPolicy, value: string): string {
  return `${policy.destination.prefix ?? ''}${value}${policy.destination.suffix ?? ''}`;
}

function validatedBoundValue(
  policy: BrowserFetchBindingPolicy,
  sourceValue: string,
): ResolvedBinding {
  let value = sourceValue;
  if (policy.source.kind === 'cookie' && policy.source.transform === 'url-decode') {
    try {
      value = decodeURIComponent(value);
    } catch {
      throw new Error(`Browser Cookie URL decoding failed for binding: ${policy.id}`);
    }
  }
  if (policy.source.kind === 'local-storage') {
    if (policy.source.jsonPointers) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value) as unknown;
      } catch {
        throw new Error(`Browser localStorage JSON is invalid for binding: ${policy.id}`);
      }
      const selected = policy.source.jsonPointers
        .map(pointer => jsonPointer(parsed, pointer))
        .find(candidate => typeof candidate === 'string' && candidate.length > 0);
      if (typeof selected !== 'string') {
        throw new Error(`Browser localStorage JSON value is missing for binding: ${policy.id}`);
      }
      value = selected;
    }
    if (policy.source.trim) value = value.trim();
  }
  const sourceBytes = utf8Bytes(sourceValue);
  const valueBytes = utf8Bytes(value);
  if (
    sourceBytes < MIN_REDACTABLE_SECRET_BYTES ||
    valueBytes < MIN_REDACTABLE_SECRET_BYTES ||
    sourceBytes > MAX_BOUND_VALUE_BYTES ||
    valueBytes > MAX_BOUND_VALUE_BYTES
  ) {
    throw new Error(`Browser state value is outside safe binding bounds: ${policy.id}`);
  }
  return { policy, sourceValue, transformedValue: value, value: decoratedValue(policy, value) };
}

async function resolveBindings(
  policies: BrowserFetchBindingPolicy[],
  cookies: BrowserCookie[],
  environment: BrowserFetchEnvironment,
): Promise<ResolvedBinding[]> {
  const result: ResolvedBinding[] = [];
  for (const policy of policies) {
    const source = policy.source;
    let sourceValue: string | null;
    if (source.kind === 'cookie') {
      sourceValue = cookies.find(candidate => candidate.name === source.name)?.value ?? null;
    } else {
      sourceValue = await environment.localStorageForOrigin(source.origin, source.key);
    }
    if (sourceValue === null || sourceValue === '') {
      if (policy.required !== false) {
        throw new Error(`Required browser state is missing for binding: ${policy.id}`);
      }
      continue;
    }
    result.push(validatedBoundValue(policy, sourceValue));
  }
  return result;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function preparedRequest(
  request: BrowserFetchRequest,
  bindings: ResolvedBinding[],
): { body: BodyInit | undefined; headers: Headers } {
  const headers = directHeaders(request.headers);
  const bodyBindingKind = bindings.find(
    binding =>
      binding.policy.destination.kind === 'form' || binding.policy.destination.kind === 'json',
  )?.policy.destination.kind;
  let body: BodyInit | undefined;
  if (bodyBindingKind === 'form') {
    const form = new URLSearchParams(request.body?.data ?? '');
    for (const { policy, value } of bindings) {
      if (policy.destination.kind === 'form') form.set(policy.destination.name, value);
    }
    const serialized = form.toString();
    if (utf8Bytes(serialized) > PANERELAY_FETCH_MAX_BODY_BYTES) {
      throw new Error('Browser fetch body exceeds the limit after browser-state binding');
    }
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    body = serialized;
  } else if (bodyBindingKind === 'json') {
    let value: unknown = {};
    if (request.body?.data) {
      try {
        value = JSON.parse(request.body.data) as unknown;
      } catch {
        throw new Error('Browser fetch JSON body is invalid for browser-state binding');
      }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Browser fetch JSON body must be an object for browser-state binding');
    }
    const object = value as Record<string, unknown>;
    for (const { policy, value: boundValue } of bindings) {
      if (policy.destination.kind === 'json') {
        object[policy.destination.name] = boundValue;
      }
    }
    const serialized = JSON.stringify(object);
    if (utf8Bytes(serialized) > PANERELAY_FETCH_MAX_BODY_BYTES) {
      throw new Error('Browser fetch body exceeds the limit after browser-state binding');
    }
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = serialized;
  } else {
    body = requestBody(request);
  }
  for (const { policy, value } of bindings) {
    if (policy.destination.kind === 'header') headers.set(policy.destination.name, value);
  }
  return { body, headers };
}

function redactString(value: string, secrets: string[]): string {
  let result = value;
  for (const secret of [...secrets].sort((left, right) => right.length - left.length)) {
    if (secret) result = result.replaceAll(secret, '[redacted]');
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

function decodeBoundResponseBody(
  bytes: Uint8Array,
  contentType: string,
  requestedType: BrowserFetchRequest['responseType'],
  secrets: string[],
): Pick<BrowserFetchResponse, 'body' | 'bodyType'> {
  if (requestedType === 'base64' || looksBinary(contentType)) {
    throw new Error('Browser-state-bound fetch requires a textual or JSON response');
  }
  const redacted = redactString(new TextDecoder().decode(bytes), secrets);
  return decodeResponseBody(new TextEncoder().encode(redacted), contentType, requestedType);
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
  bindingPolicies: BrowserFetchBindingPolicy[],
  target: URL,
  environment: BrowserFetchEnvironment,
  signal?: AbortSignal,
): Promise<BrowserFetchResponse> {
  signal?.throwIfAborted();
  const targetUrl = target.toString();
  let cookies: BrowserCookie[] = [];
  if (
    request.withCookies !== false ||
    bindingPolicies.some(policy => policy.source.kind === 'cookie')
  ) {
    try {
      cookies = await environment.cookiesForUrl(targetUrl);
    } catch (error) {
      throw siteAccessFailure(target, 'cookie access', error);
    }
  }
  cookies = orderedCookies(cookies);
  let bindings: ResolvedBinding[] = [];
  try {
    bindings = await resolveBindings(bindingPolicies, cookies, environment);
    signal?.throwIfAborted();
  } catch (error) {
    throw sanitizedError(
      error,
      bindings.map(binding => binding.value),
    );
  }
  const secrets = [
    ...new Set(
      bindings
        .flatMap(binding => [binding.sourceValue, binding.transformedValue, binding.value])
        .filter(Boolean),
    ),
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
    const abortFromCaller = () => abort.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeoutMs = request.timeoutMs ?? PANERELAY_FETCH_DEFAULT_TIMEOUT_MS;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, timeoutMs);
    let response: Response;
    try {
      response = await environment.fetch(targetUrl, {
        method: request.method ?? 'GET',
        headers: prepared.headers,
        body: prepared.body,
        credentials: 'include',
        redirect: 'error',
        signal: abort.signal,
      });
    } catch (error) {
      if (abort.signal.aborted) {
        if (!timedOut) throw new Error('Browser fetch was cancelled', { cause: error });
        throw new Error(`Browser fetch timed out after ${timeoutMs} ms`, { cause: error });
      }
      throw sanitizedError(siteAccessFailure(target, 'request', error), secrets);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromCaller);
    }

    const bytes = await readBoundedBody(response);
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const decoded =
      bindings.length > 0
        ? decodeBoundResponseBody(bytes, contentType, request.responseType ?? 'auto', secrets)
        : decodeResponseBody(bytes, contentType, request.responseType ?? 'auto');
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
  bindingPolicies: BrowserFetchBindingPolicy[],
  environment: BrowserFetchEnvironment,
  signal?: AbortSignal,
): Promise<BrowserFetchResponse> {
  const target = new URL(request.url);
  target.hash = '';
  appendQuery(target, request);
  return serializeUrl(target.toString(), () =>
    executeSerialized(request, bindingPolicies, target, environment, signal),
  );
}

function escapeDnrRegex(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

export function createChromeBrowserFetchEnvironment(): BrowserFetchEnvironment {
  return {
    cookiesForUrl: async url =>
      (await chrome.cookies.getAll({ url })).filter(cookie => cookie.partitionKey === undefined),
    localStorageForOrigin: async (origin, key) => {
      const tabs = (await chrome.tabs.query({}))
        .filter(
          (tab): tab is chrome.tabs.Tab & { id: number; url: string } =>
            typeof tab.id === 'number' &&
            typeof tab.url === 'string' &&
            (() => {
              try {
                return new URL(tab.url).origin === origin;
              } catch {
                return false;
              }
            })(),
        )
        .sort(
          (left, right) =>
            (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0) || left.id - right.id,
        );
      const tab = tabs[0];
      if (!tab) throw new Error(`No open browser tab matches localStorage origin: ${origin}`);
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: storageKey => localStorage.getItem(storageKey),
        args: [key],
      });
      return typeof injection?.result === 'string' ? injection.result : null;
    },
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
