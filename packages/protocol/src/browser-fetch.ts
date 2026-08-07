import { PANERELAY_PROTOCOL_VERSION } from './constants.js';

export const PANERELAY_FETCH_SESSION_PROTOCOL = 'panerelay.fetch-session.v1' as const;
export const PANERELAY_FETCH_ADAPTER_PROTOCOL = 'panerelay.fetch-adapter.v1' as const;
export const PANERELAY_FETCH_ADAPTER_REGISTRY_PROTOCOL =
  'panerelay.fetch-adapter-registry.v1' as const;
export const PANERELAY_FETCH_MAX_URL_BYTES = 8 * 1024;
export const PANERELAY_FETCH_MAX_HEADERS = 128;
export const PANERELAY_FETCH_MAX_HEADER_BYTES = 64 * 1024;
export const PANERELAY_FETCH_MAX_COOKIE_BINDINGS = 16;
export const PANERELAY_FETCH_MAX_BODY_BYTES = 8 * 1024 * 1024;
export const PANERELAY_FETCH_MAX_RESPONSE_BODY_BYTES = 32 * 1024 * 1024;
export const PANERELAY_FETCH_MAX_HTTP_REQUEST_BYTES = 12 * 1024 * 1024;
export const PANERELAY_FETCH_MIN_TIMEOUT_MS = 100;
export const PANERELAY_FETCH_MAX_TIMEOUT_MS = 120_000;
export const PANERELAY_FETCH_DEFAULT_TIMEOUT_MS = 30_000;
export const PANERELAY_FETCH_SESSION_TTL_MS = 120_000;
export const PANERELAY_FETCH_MAX_SESSIONS = 16;
export const PANERELAY_FETCH_ADAPTER_MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;
export const PANERELAY_FETCH_ADAPTER_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
export const PANERELAY_FETCH_ADAPTER_MAX_STDERR_BYTES = 64 * 1024;

export const PANERELAY_FETCH_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
] as const;
export type BrowserFetchMethod = (typeof PANERELAY_FETCH_METHODS)[number];
export type BrowserFetchResponseType = 'auto' | 'json' | 'text' | 'base64';

export interface BrowserFetchBody {
  encoding: 'utf8' | 'base64';
  data: string;
}

export interface BrowserFetchQueryEntry {
  name: string;
  value: string;
}

export type BrowserFetchCookieBindingDestinationKind = 'form' | 'json' | 'header';
export type BrowserFetchCookieBindingTransform = 'raw' | 'url-decode';

export interface BrowserFetchCookieBinding {
  cookieName: string;
  destination: {
    kind: BrowserFetchCookieBindingDestinationKind;
    name: string;
  };
  transform?: BrowserFetchCookieBindingTransform;
  required?: boolean;
}

export interface BrowserFetchRequest {
  url: string;
  method?: BrowserFetchMethod;
  headers?: Record<string, string>;
  query?: BrowserFetchQueryEntry[];
  body?: BrowserFetchBody;
  withCookies?: boolean;
  cookieBindings?: BrowserFetchCookieBinding[];
  responseType?: BrowserFetchResponseType;
  timeoutMs?: number;
}

export interface BrowserFetchResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  bodyType: 'json' | 'text' | 'base64';
  url: string;
  redirected: boolean;
  attachedCookieCount: number;
}

export interface BrowserFetchRequestMessage {
  type: 'fetch.request';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  browserId: string;
  generation: string;
  request: BrowserFetchRequest;
}

export interface BrowserFetchResultMessage {
  type: 'fetch.result';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  success: boolean;
  response?: BrowserFetchResponse;
  error?: string;
}

export interface BrowserFetchSessionCreateRequest {
  protocol: typeof PANERELAY_FETCH_SESSION_PROTOCOL;
  browser: {
    browserId: string;
    generation: string;
  };
}

export interface BrowserFetchSessionCreated {
  protocol: typeof PANERELAY_FETCH_SESSION_PROTOCOL;
  sessionId: string;
  endpoint: string;
  token: string;
  expiresAt: string;
}

export interface BrowserFetchSessionError {
  protocol: typeof PANERELAY_FETCH_SESSION_PROTOCOL;
  error: string;
}

export type FetchAdapterArgumentType = 'string' | 'number' | 'boolean';

export interface FetchAdapterArgument {
  name: string;
  description: string;
  type: FetchAdapterArgumentType;
  required?: boolean;
  positional?: boolean;
  default?: string | number | boolean;
}

export interface FetchAdapterCommand {
  name: string;
  description: string;
  access: 'read' | 'write';
  args: FetchAdapterArgument[];
  output: string[];
  examples: string[];
}

export interface FetchAdapterManifest {
  protocol: typeof PANERELAY_FETCH_ADAPTER_PROTOCOL;
  id: string;
  name: string;
  version: string;
  description: string;
  entry: string;
  commands: FetchAdapterCommand[];
}

export interface FetchAdapterRegistration {
  manifest: FetchAdapterManifest;
  executablePath: string;
  sha256: string;
}

export interface FetchAdapterRegistry {
  protocol: typeof PANERELAY_FETCH_ADAPTER_REGISTRY_PROTOCOL;
  adapters: FetchAdapterRegistration[];
}

export interface FetchAdapterInvocationRequest {
  protocol: typeof PANERELAY_FETCH_ADAPTER_PROTOCOL;
  requestId: string;
  operation: 'execute';
  command: string;
  args: Record<string, string | number | boolean>;
  fetch: {
    endpoint: string;
    token: string;
    expiresAt: string;
  };
}

export interface FetchAdapterInvocationResponse {
  protocol: typeof PANERELAY_FETCH_ADAPTER_PROTOCOL;
  requestId: string;
  operation: 'execute';
  success: boolean;
  result?: unknown;
  error?: string;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function hasAllowedKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}

function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.length >= minimum && bytes(value) <= maximum;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
}

function isFieldName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(value);
}

function isSafeEntry(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.mjs$/.test(value) &&
    value !== '.' &&
    value !== '..'
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function decodedBase64Bytes(
  value: string,
  maximum = PANERELAY_FETCH_MAX_BODY_BYTES,
): number | null {
  if (value.length === 0) return 0;
  if (value.length > Math.ceil((maximum * 4) / 3) + 4) return null;
  if (
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value) ||
    value.slice(0, -2).includes('=') ||
    (value.endsWith('==') && value.length >= 2 && !/[A-Za-z0-9+/]==$/.test(value)) ||
    (value.endsWith('=') && !value.endsWith('==') && !/[A-Za-z0-9+/]{2}=$/.test(value))
  ) {
    return null;
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

function isHeaders(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    entries.length <= PANERELAY_FETCH_MAX_HEADERS &&
    entries.every(
      ([name, headerValue]) =>
        /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) &&
        typeof headerValue === 'string' &&
        !/[\r\n]/.test(headerValue),
    ) &&
    entries.reduce(
      (total, [name, headerValue]) => total + bytes(name) + bytes(String(headerValue)),
      0,
    ) <= PANERELAY_FETCH_MAX_HEADER_BYTES
  );
}

function isQuery(value: unknown): value is BrowserFetchQueryEntry[] {
  return (
    Array.isArray(value) &&
    value.length <= 256 &&
    value.every(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
      const candidate = entry as Record<string, unknown>;
      return (
        hasExactKeys(candidate, ['name', 'value']) &&
        isBoundedString(candidate.name, 1, 1_024) &&
        isBoundedString(candidate.value, 0, 8 * 1_024)
      );
    })
  );
}

function isBody(value: unknown): value is BrowserFetchBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !hasExactKeys(candidate, ['encoding', 'data']) ||
    (candidate.encoding !== 'utf8' && candidate.encoding !== 'base64') ||
    typeof candidate.data !== 'string'
  ) {
    return false;
  }
  const length =
    candidate.encoding === 'utf8' ? bytes(candidate.data) : decodedBase64Bytes(candidate.data);
  return length !== null && length <= PANERELAY_FETCH_MAX_BODY_BYTES;
}

const RESERVED_BOUND_HEADER_NAMES = new Set([
  'cookie',
  'origin',
  'referer',
  'host',
  'content-length',
]);

function isCookieBinding(value: unknown): value is BrowserFetchCookieBinding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !hasAllowedKeys(candidate, ['cookieName', 'destination', 'transform', 'required']) ||
    !isBoundedString(candidate.cookieName, 1, 256) ||
    !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(candidate.cookieName) ||
    (candidate.transform !== undefined &&
      candidate.transform !== 'raw' &&
      candidate.transform !== 'url-decode') ||
    (candidate.required !== undefined && typeof candidate.required !== 'boolean') ||
    !candidate.destination ||
    typeof candidate.destination !== 'object' ||
    Array.isArray(candidate.destination)
  ) {
    return false;
  }
  const destination = candidate.destination as Record<string, unknown>;
  if (
    !hasExactKeys(destination, ['kind', 'name']) ||
    !['form', 'json', 'header'].includes(destination.kind as string) ||
    !isBoundedString(destination.name, 1, 256) ||
    /[\r\n]/.test(destination.name as string)
  ) {
    return false;
  }
  if (destination.kind !== 'header') return !/[&=]/.test(destination.name as string);
  return (
    /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(destination.name as string) &&
    !RESERVED_BOUND_HEADER_NAMES.has((destination.name as string).toLowerCase())
  );
}

function headerValue(
  headers: Record<string, string> | undefined,
  expectedName: string,
): string | undefined {
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (name.toLowerCase() === expectedName) return value;
  }
  return undefined;
}

function isCookieBindings(
  value: unknown,
  method: BrowserFetchMethod,
  headers: Record<string, string> | undefined,
  body: BrowserFetchBody | undefined,
): value is BrowserFetchCookieBinding[] {
  if (!Array.isArray(value) || value.length > PANERELAY_FETCH_MAX_COOKIE_BINDINGS) return false;
  if (!value.every(isCookieBinding)) return false;
  const destinations = value.map(binding =>
    binding.destination.kind === 'header'
      ? `header:${binding.destination.name.toLowerCase()}`
      : `${binding.destination.kind}:${binding.destination.name}`,
  );
  if (new Set(destinations).size !== destinations.length) return false;
  const bodyKinds = new Set(
    value
      .map(binding => binding.destination.kind)
      .filter(kind => kind === 'form' || kind === 'json'),
  );
  if (bodyKinds.size > 1) return false;
  if (bodyKinds.size === 0) return true;
  if (method === 'GET' || method === 'HEAD' || body?.encoding === 'base64') return false;
  const contentType = headerValue(headers, 'content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!contentType) return true;
  if (bodyKinds.has('form')) return contentType === 'application/x-www-form-urlencoded';
  return contentType === 'application/json' || contentType.endsWith('+json');
}

export function isBrowserFetchRequest(value: unknown): value is BrowserFetchRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !hasAllowedKeys(candidate, [
      'url',
      'method',
      'headers',
      'query',
      'body',
      'withCookies',
      'cookieBindings',
      'responseType',
      'timeoutMs',
    ]) ||
    !isBoundedString(candidate.url, 1, PANERELAY_FETCH_MAX_URL_BYTES)
  ) {
    return false;
  }
  try {
    const url = new URL(candidate.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
  } catch {
    return false;
  }
  const method = candidate.method ?? 'GET';
  if (!PANERELAY_FETCH_METHODS.includes(method as BrowserFetchMethod)) return false;
  if (candidate.headers !== undefined && !isHeaders(candidate.headers)) return false;
  if (
    candidate.headers !== undefined &&
    Object.keys(candidate.headers).some(name => name.toLowerCase() === 'cookie')
  ) {
    return false;
  }
  if (candidate.query !== undefined && !isQuery(candidate.query)) return false;
  if (candidate.body !== undefined && !isBody(candidate.body)) return false;
  if ((method === 'GET' || method === 'HEAD') && candidate.body !== undefined) return false;
  if (candidate.withCookies !== undefined && typeof candidate.withCookies !== 'boolean')
    return false;
  if (
    candidate.cookieBindings !== undefined &&
    !isCookieBindings(
      candidate.cookieBindings,
      method as BrowserFetchMethod,
      candidate.headers as Record<string, string> | undefined,
      candidate.body as BrowserFetchBody | undefined,
    )
  ) {
    return false;
  }
  if (
    candidate.responseType !== undefined &&
    !['auto', 'json', 'text', 'base64'].includes(candidate.responseType as string)
  ) {
    return false;
  }
  return (
    candidate.timeoutMs === undefined ||
    (typeof candidate.timeoutMs === 'number' &&
      Number.isSafeInteger(candidate.timeoutMs) &&
      candidate.timeoutMs >= PANERELAY_FETCH_MIN_TIMEOUT_MS &&
      candidate.timeoutMs <= PANERELAY_FETCH_MAX_TIMEOUT_MS)
  );
}

export function isBrowserFetchResponse(value: unknown): value is BrowserFetchResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const validBody = (() => {
    if (candidate.bodyType === 'text') {
      return (
        typeof candidate.body === 'string' &&
        bytes(candidate.body) <= PANERELAY_FETCH_MAX_RESPONSE_BODY_BYTES
      );
    }
    if (candidate.bodyType === 'base64') {
      return (
        typeof candidate.body === 'string' &&
        decodedBase64Bytes(candidate.body, PANERELAY_FETCH_MAX_RESPONSE_BODY_BYTES) !== null
      );
    }
    if (candidate.bodyType !== 'json') return false;
    try {
      const serialized = JSON.stringify(candidate.body);
      return (
        serialized !== undefined && bytes(serialized) <= PANERELAY_FETCH_MAX_RESPONSE_BODY_BYTES
      );
    } catch {
      return false;
    }
  })();
  return (
    hasExactKeys(candidate, [
      'status',
      'statusText',
      'headers',
      'body',
      'bodyType',
      'url',
      'redirected',
      'attachedCookieCount',
    ]) &&
    typeof candidate.status === 'number' &&
    Number.isSafeInteger(candidate.status) &&
    candidate.status >= 0 &&
    candidate.status <= 999 &&
    isBoundedString(candidate.statusText, 0, 1_024) &&
    isHeaders(candidate.headers) &&
    ['json', 'text', 'base64'].includes(candidate.bodyType as string) &&
    validBody &&
    isBoundedString(candidate.url, 1, PANERELAY_FETCH_MAX_URL_BYTES) &&
    typeof candidate.redirected === 'boolean' &&
    typeof candidate.attachedCookieCount === 'number' &&
    Number.isSafeInteger(candidate.attachedCookieCount) &&
    candidate.attachedCookieCount >= 0
  );
}

export function isBrowserFetchRequestMessage(value: unknown): value is BrowserFetchRequestMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    hasExactKeys(candidate, [
      'type',
      'protocol',
      'requestId',
      'browserId',
      'generation',
      'request',
    ]) &&
    candidate.type === 'fetch.request' &&
    candidate.protocol === PANERELAY_PROTOCOL_VERSION &&
    isBoundedString(candidate.requestId, 1, 128) &&
    isBoundedString(candidate.browserId, 1, 256) &&
    isBoundedString(candidate.generation, 1, 128) &&
    isBrowserFetchRequest(candidate.request)
  );
}

export function isBrowserFetchResultMessage(value: unknown): value is BrowserFetchResultMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const expected = candidate.success
    ? ['type', 'protocol', 'requestId', 'success', 'response']
    : ['type', 'protocol', 'requestId', 'success', 'error'];
  return (
    hasExactKeys(candidate, expected) &&
    candidate.type === 'fetch.result' &&
    candidate.protocol === PANERELAY_PROTOCOL_VERSION &&
    isBoundedString(candidate.requestId, 1, 128) &&
    typeof candidate.success === 'boolean' &&
    (candidate.success
      ? isBrowserFetchResponse(candidate.response)
      : isBoundedString(candidate.error, 1, 2_048))
  );
}

export function isBrowserFetchSessionCreateRequest(
  value: unknown,
): value is BrowserFetchSessionCreateRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !hasExactKeys(candidate, ['protocol', 'browser']) ||
    candidate.protocol !== PANERELAY_FETCH_SESSION_PROTOCOL ||
    !candidate.browser ||
    typeof candidate.browser !== 'object' ||
    Array.isArray(candidate.browser)
  ) {
    return false;
  }
  const browser = candidate.browser as Record<string, unknown>;
  return (
    hasExactKeys(browser, ['browserId', 'generation']) &&
    isBoundedString(browser.browserId, 1, 256) &&
    isBoundedString(browser.generation, 1, 128)
  );
}

function isLoopbackFetchEndpoint(value: unknown): value is string {
  if (!isBoundedString(value, 1, 2_048)) return false;
  try {
    const endpoint = new URL(value);
    return (
      endpoint.protocol === 'http:' &&
      ['127.0.0.1', '[::1]'].includes(endpoint.hostname) &&
      endpoint.pathname === '/fetch' &&
      endpoint.search === '' &&
      endpoint.hash === ''
    );
  } catch {
    return false;
  }
}

export function isBrowserFetchSessionCreated(value: unknown): value is BrowserFetchSessionCreated {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    hasExactKeys(candidate, ['protocol', 'sessionId', 'endpoint', 'token', 'expiresAt']) &&
    candidate.protocol === PANERELAY_FETCH_SESSION_PROTOCOL &&
    isBoundedString(candidate.sessionId, 1, 128) &&
    isLoopbackFetchEndpoint(candidate.endpoint) &&
    isBoundedString(candidate.token, 16, 256) &&
    isIsoDate(candidate.expiresAt)
  );
}

export function isBrowserFetchSessionError(value: unknown): value is BrowserFetchSessionError {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    hasExactKeys(candidate, ['protocol', 'error']) &&
    candidate.protocol === PANERELAY_FETCH_SESSION_PROTOCOL &&
    isBoundedString(candidate.error, 1, 2_048)
  );
}

function isAdapterDefault(type: FetchAdapterArgumentType, value: unknown): boolean {
  return value === undefined || typeof value === type;
}

function isFetchAdapterArgument(value: unknown): value is FetchAdapterArgument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !hasAllowedKeys(candidate, [
      'name',
      'description',
      'type',
      'required',
      'positional',
      'default',
    ]) ||
    !isIdentifier(candidate.name) ||
    !isBoundedString(candidate.description, 1, 1_024) ||
    !['string', 'number', 'boolean'].includes(candidate.type as string) ||
    (candidate.required !== undefined && typeof candidate.required !== 'boolean') ||
    (candidate.positional !== undefined && typeof candidate.positional !== 'boolean') ||
    (candidate.required === true && candidate.default !== undefined)
  ) {
    return false;
  }
  return isAdapterDefault(candidate.type as FetchAdapterArgumentType, candidate.default);
}

function isFetchAdapterCommand(value: unknown): value is FetchAdapterCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !hasExactKeys(candidate, ['name', 'description', 'access', 'args', 'output', 'examples']) ||
    !isIdentifier(candidate.name) ||
    !isBoundedString(candidate.description, 1, 2_048) ||
    (candidate.access !== 'read' && candidate.access !== 'write') ||
    !Array.isArray(candidate.args) ||
    candidate.args.length > 64 ||
    !candidate.args.every(isFetchAdapterArgument) ||
    new Set(candidate.args.map(argument => argument.name)).size !== candidate.args.length ||
    !Array.isArray(candidate.output) ||
    candidate.output.length > 128 ||
    !candidate.output.every(isFieldName) ||
    new Set(candidate.output).size !== candidate.output.length ||
    !Array.isArray(candidate.examples) ||
    candidate.examples.length > 16 ||
    !candidate.examples.every(example => isBoundedString(example, 1, 2_048))
  ) {
    return false;
  }
  const positional = candidate.args.filter(argument => argument.positional);
  const optionalBeforeRequired = positional.some(
    (argument, index) =>
      !argument.required && positional.slice(index + 1).some(later => later.required),
  );
  return !optionalBeforeRequired;
}

export function isFetchAdapterManifest(value: unknown): value is FetchAdapterManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    hasExactKeys(candidate, [
      'protocol',
      'id',
      'name',
      'version',
      'description',
      'entry',
      'commands',
    ]) &&
    candidate.protocol === PANERELAY_FETCH_ADAPTER_PROTOCOL &&
    isIdentifier(candidate.id) &&
    isBoundedString(candidate.name, 1, 128) &&
    isBoundedString(candidate.version, 1, 64) &&
    /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(candidate.version) &&
    isBoundedString(candidate.description, 1, 2_048) &&
    isSafeEntry(candidate.entry) &&
    Array.isArray(candidate.commands) &&
    candidate.commands.length > 0 &&
    candidate.commands.length <= 128 &&
    candidate.commands.every(isFetchAdapterCommand) &&
    new Set(candidate.commands.map(command => command.name)).size === candidate.commands.length
  );
}

export function isFetchAdapterRegistration(value: unknown): value is FetchAdapterRegistration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    hasExactKeys(candidate, ['manifest', 'executablePath', 'sha256']) &&
    isFetchAdapterManifest(candidate.manifest) &&
    typeof candidate.executablePath === 'string' &&
    candidate.executablePath.length > 0 &&
    /^[0-9a-f]{64}$/.test(String(candidate.sha256))
  );
}

export function isFetchAdapterRegistry(value: unknown): value is FetchAdapterRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    hasExactKeys(candidate, ['protocol', 'adapters']) &&
    candidate.protocol === PANERELAY_FETCH_ADAPTER_REGISTRY_PROTOCOL &&
    Array.isArray(candidate.adapters) &&
    candidate.adapters.length <= 128 &&
    candidate.adapters.every(isFetchAdapterRegistration) &&
    new Set(candidate.adapters.map(adapter => adapter.manifest.id)).size ===
      candidate.adapters.length
  );
}

function isAdapterArguments(value: unknown): value is Record<string, string | number | boolean> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.entries(value as Record<string, unknown>).length <= 64 &&
    Object.entries(value as Record<string, unknown>).every(
      ([name, argument]) =>
        isIdentifier(name) && ['string', 'number', 'boolean'].includes(typeof argument),
    )
  );
}

export function isFetchAdapterInvocationRequest(
  value: unknown,
): value is FetchAdapterInvocationRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !hasExactKeys(candidate, ['protocol', 'requestId', 'operation', 'command', 'args', 'fetch']) ||
    candidate.protocol !== PANERELAY_FETCH_ADAPTER_PROTOCOL ||
    !isBoundedString(candidate.requestId, 1, 128) ||
    candidate.operation !== 'execute' ||
    !isIdentifier(candidate.command) ||
    !isAdapterArguments(candidate.args) ||
    !candidate.fetch ||
    typeof candidate.fetch !== 'object' ||
    Array.isArray(candidate.fetch)
  ) {
    return false;
  }
  const fetchSession = candidate.fetch as Record<string, unknown>;
  return (
    hasExactKeys(fetchSession, ['endpoint', 'token', 'expiresAt']) &&
    isBoundedString(fetchSession.endpoint, 1, 2_048) &&
    isLoopbackFetchEndpoint(fetchSession.endpoint) &&
    isBoundedString(fetchSession.token, 16, 256) &&
    isIsoDate(fetchSession.expiresAt)
  );
}

export function isFetchAdapterInvocationResponse(
  value: unknown,
): value is FetchAdapterInvocationResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const expected = candidate.success
    ? ['protocol', 'requestId', 'operation', 'success', 'result']
    : ['protocol', 'requestId', 'operation', 'success', 'error'];
  return (
    hasExactKeys(candidate, expected) &&
    candidate.protocol === PANERELAY_FETCH_ADAPTER_PROTOCOL &&
    isBoundedString(candidate.requestId, 1, 128) &&
    candidate.operation === 'execute' &&
    typeof candidate.success === 'boolean' &&
    (candidate.success || isBoundedString(candidate.error, 1, 4_096))
  );
}

export function serializeFetchAdapterMessage(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}
