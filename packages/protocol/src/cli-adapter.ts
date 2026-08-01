export const PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION = 'panerelay.cli-adapter.v1' as const;
export const CLI_ADAPTER_MAX_MESSAGE_BYTES = 64 * 1024;
export const CLI_ADAPTER_MAX_ENVIRONMENT_BYTES = 16 * 1024;
export const CLI_ADAPTER_MAX_ENVIRONMENT_KEYS = 16;
export const CLI_ADAPTER_MAX_DOCTOR_CHECKS = 32;

export type CliAdapterOperation = 'adapter.manifest' | 'connection.resolve' | 'adapter.doctor';
export type CliAdapterCapability = 'connection.resolve' | 'adapter.doctor';
export type CliAdapterMode = 'direct' | 'extension';
export type CliAdapterConnectionKind = 'direct' | 'cdp-http' | 'cdp-websocket';
export type CliAdapterDoctorStatus = 'ready' | 'degraded' | 'unavailable';
export type CliAdapterDoctorCheckStatus = 'pass' | 'warning' | 'fail';
export type CliAdapterErrorCode =
  | 'invalid-request'
  | 'incompatible-protocol'
  | 'unsupported-operation'
  | 'adapter-unavailable'
  | 'browser-unavailable'
  | 'generation-changed'
  | 'not-ready'
  | 'busy'
  | 'timeout'
  | 'internal-error';

export interface CliAdapterActor {
  name: string;
  sessionLabel?: string;
}

export interface CliAdapterBrowserSelection {
  browserId: string;
  generation: string;
}

export interface CliAdapterManifestRequest {
  protocol: typeof PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION;
  requestId: string;
  operation: 'adapter.manifest';
  input: Record<string, never>;
}

export interface CliAdapterResolveRequest {
  protocol: typeof PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION;
  requestId: string;
  operation: 'connection.resolve';
  input: {
    mode: CliAdapterMode;
    actor: CliAdapterActor;
    browser?: CliAdapterBrowserSelection;
  };
}

export interface CliAdapterDoctorRequest {
  protocol: typeof PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION;
  requestId: string;
  operation: 'adapter.doctor';
  input: Record<string, never>;
}

export type CliAdapterRequest =
  CliAdapterManifestRequest | CliAdapterResolveRequest | CliAdapterDoctorRequest;

export interface CliAdapterManifest {
  adapterId: string;
  name: string;
  version: string;
  protocol: typeof PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION;
  capabilities: CliAdapterCapability[];
  modes: CliAdapterMode[];
  childEnvironmentKeys: string[];
}

export interface CliAdapterResolvedConnection {
  mode: CliAdapterMode;
  connection: {
    kind: CliAdapterConnectionKind;
    url?: string;
  };
  environment: Record<string, string>;
  expiresAt?: string;
  concurrencyKey?: string;
}

export interface CliAdapterDoctorCheck {
  id: string;
  status: CliAdapterDoctorCheckStatus;
  message?: string;
  version?: string;
}

export interface CliAdapterDoctorResult {
  status: CliAdapterDoctorStatus;
  checks: CliAdapterDoctorCheck[];
}

export type CliAdapterOperationResult =
  CliAdapterManifest | CliAdapterResolvedConnection | CliAdapterDoctorResult;

export interface CliAdapterSuccessResponse {
  protocol: typeof PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION;
  requestId: string;
  operation: CliAdapterOperation;
  success: true;
  result: CliAdapterOperationResult;
}

export interface CliAdapterFailureResponse {
  protocol: typeof PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION;
  requestId: string;
  operation: CliAdapterOperation;
  success: false;
  error: {
    code: CliAdapterErrorCode;
    message: string;
    retryable: boolean;
  };
}

export type CliAdapterResponse = CliAdapterSuccessResponse | CliAdapterFailureResponse;

const OPERATIONS = new Set<CliAdapterOperation>([
  'adapter.manifest',
  'connection.resolve',
  'adapter.doctor',
]);
const CAPABILITIES = new Set<CliAdapterCapability>(['connection.resolve', 'adapter.doctor']);
const MODES = new Set<CliAdapterMode>(['direct', 'extension']);
const CONNECTION_KINDS = new Set<CliAdapterConnectionKind>(['direct', 'cdp-http', 'cdp-websocket']);
const DOCTOR_STATUSES = new Set<CliAdapterDoctorStatus>(['ready', 'degraded', 'unavailable']);
const DOCTOR_CHECK_STATUSES = new Set<CliAdapterDoctorCheckStatus>(['pass', 'warning', 'fail']);
const ERROR_CODES = new Set<CliAdapterErrorCode>([
  'invalid-request',
  'incompatible-protocol',
  'unsupported-operation',
  'adapter-unavailable',
  'browser-unavailable',
  'generation-changed',
  'not-ready',
  'busy',
  'timeout',
  'internal-error',
]);
const FORBIDDEN_ENVIRONMENT_KEYS = new Set([
  'PATH',
  'HOME',
  'USERPROFILE',
  'SHELL',
  'COMSPEC',
  'NODE_OPTIONS',
  'NODE_PATH',
  'PYTHONPATH',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every(key => allowedKeys.has(key));
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  return hasOnlyKeys(value, required) && required.every(key => key in value);
}

function isBoundedString(value: unknown, maximum: number, minimum = 1): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

function isRequestId(value: unknown): value is string {
  return isBoundedString(value, 128) && /^[A-Za-z0-9._:-]+$/.test(value);
}

function isIdentifier(value: unknown, maximum = 64): value is string {
  return isBoundedString(value, maximum) && /^[a-z][a-z0-9-]*$/.test(value);
}

function isVersion(value: unknown): value is string {
  return isBoundedString(value, 64) && /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/.test(value);
}

function isIsoDate(value: unknown): value is string {
  return isBoundedString(value, 64) && Number.isFinite(Date.parse(value));
}

function isUniqueEnumList<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  maximum: number,
): value is T[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= maximum &&
    value.every(item => typeof item === 'string' && allowed.has(item as T)) &&
    new Set(value).size === value.length
  );
}

export function isSafeCliAdapterEnvironmentKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Z][A-Z0-9_]{0,63}$/.test(value) &&
    !FORBIDDEN_ENVIRONMENT_KEYS.has(value) &&
    !value.startsWith('LD_') &&
    !value.startsWith('DYLD_')
  );
}

function isActor(value: unknown): value is CliAdapterActor {
  if (!isRecord(value) || !hasOnlyKeys(value, ['name', 'sessionLabel'])) return false;
  return (
    isBoundedString(value.name, 64) &&
    (value.sessionLabel === undefined || isBoundedString(value.sessionLabel, 128))
  );
}

function isBrowserSelection(value: unknown): value is CliAdapterBrowserSelection {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['browserId', 'generation']) &&
    isBoundedString(value.browserId, 128) &&
    isBoundedString(value.generation, 128) &&
    /^[A-Za-z0-9._:-]+$/.test(value.generation)
  );
}

export function isCliAdapterRequest(value: unknown): value is CliAdapterRequest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['protocol', 'requestId', 'operation', 'input']) ||
    value.protocol !== PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION ||
    !isRequestId(value.requestId) ||
    typeof value.operation !== 'string' ||
    !OPERATIONS.has(value.operation as CliAdapterOperation) ||
    !isRecord(value.input)
  ) {
    return false;
  }
  if (value.operation === 'adapter.manifest' || value.operation === 'adapter.doctor') {
    return Object.keys(value.input).length === 0;
  }
  if (!hasOnlyKeys(value.input, ['mode', 'actor', 'browser'])) return false;
  if (typeof value.input.mode !== 'string' || !MODES.has(value.input.mode as CliAdapterMode)) {
    return false;
  }
  if (!isActor(value.input.actor)) return false;
  return value.input.mode === 'extension'
    ? isBrowserSelection(value.input.browser)
    : value.input.browser === undefined;
}

export function isCliAdapterManifest(value: unknown): value is CliAdapterManifest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'adapterId',
      'name',
      'version',
      'protocol',
      'capabilities',
      'modes',
      'childEnvironmentKeys',
    ])
  ) {
    return false;
  }
  return (
    isIdentifier(value.adapterId) &&
    isBoundedString(value.name, 128) &&
    isVersion(value.version) &&
    value.protocol === PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION &&
    isUniqueEnumList(value.capabilities, CAPABILITIES, CAPABILITIES.size) &&
    isUniqueEnumList(value.modes, MODES, MODES.size) &&
    Array.isArray(value.childEnvironmentKeys) &&
    value.childEnvironmentKeys.length <= CLI_ADAPTER_MAX_ENVIRONMENT_KEYS &&
    value.childEnvironmentKeys.every(isSafeCliAdapterEnvironmentKey) &&
    new Set(value.childEnvironmentKeys).size === value.childEnvironmentKeys.length
  );
}

function isResolvedConnection(value: unknown): value is CliAdapterResolvedConnection {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['mode', 'connection', 'environment', 'expiresAt', 'concurrencyKey']) ||
    !('mode' in value) ||
    !('connection' in value) ||
    !('environment' in value) ||
    typeof value.mode !== 'string' ||
    !MODES.has(value.mode as CliAdapterMode) ||
    !isRecord(value.connection) ||
    !hasOnlyKeys(value.connection, ['kind', 'url']) ||
    typeof value.connection.kind !== 'string' ||
    !CONNECTION_KINDS.has(value.connection.kind as CliAdapterConnectionKind) ||
    !isRecord(value.environment)
  ) {
    return false;
  }
  const entries = Object.entries(value.environment);
  const environmentBytes = new TextEncoder().encode(JSON.stringify(value.environment)).byteLength;
  if (
    entries.length > CLI_ADAPTER_MAX_ENVIRONMENT_KEYS ||
    environmentBytes > CLI_ADAPTER_MAX_ENVIRONMENT_BYTES ||
    entries.some(
      ([key, entry]) =>
        !isSafeCliAdapterEnvironmentKey(key) ||
        typeof entry !== 'string' ||
        entry.length > 4_096 ||
        entry.includes('\0'),
    )
  ) {
    return false;
  }
  const url = value.connection.url;
  if (
    (url !== undefined && !isBoundedString(url, 4_096)) ||
    (value.connection.kind === 'direct' && url !== undefined) ||
    (value.connection.kind !== 'direct' && url === undefined) ||
    (value.mode === 'direct' && value.connection.kind !== 'direct') ||
    (value.mode === 'extension' && value.connection.kind === 'direct')
  ) {
    return false;
  }
  if (typeof url === 'string') {
    try {
      const parsed = new URL(url);
      if (!['http:', 'ws:', 'https:', 'wss:'].includes(parsed.protocol)) return false;
    } catch {
      return false;
    }
  }
  return (
    (value.expiresAt === undefined || isIsoDate(value.expiresAt)) &&
    (value.concurrencyKey === undefined ||
      (isBoundedString(value.concurrencyKey, 128) &&
        /^[A-Za-z0-9._:-]+$/.test(value.concurrencyKey)))
  );
}

function isDoctorResult(value: unknown): value is CliAdapterDoctorResult {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['status', 'checks']) ||
    typeof value.status !== 'string' ||
    !DOCTOR_STATUSES.has(value.status as CliAdapterDoctorStatus) ||
    !Array.isArray(value.checks) ||
    value.checks.length > CLI_ADAPTER_MAX_DOCTOR_CHECKS
  ) {
    return false;
  }
  const ids = new Set<string>();
  for (const check of value.checks) {
    if (
      !isRecord(check) ||
      !hasOnlyKeys(check, ['id', 'status', 'message', 'version']) ||
      !isIdentifier(check.id) ||
      ids.has(check.id) ||
      typeof check.status !== 'string' ||
      !DOCTOR_CHECK_STATUSES.has(check.status as CliAdapterDoctorCheckStatus) ||
      (check.message !== undefined && !isBoundedString(check.message, 512)) ||
      (check.version !== undefined && !isVersion(check.version))
    ) {
      return false;
    }
    ids.add(check.id);
  }
  return true;
}

function isFailure(value: Record<string, unknown>): boolean {
  if (!hasExactKeys(value, ['protocol', 'requestId', 'operation', 'success', 'error'])) {
    return false;
  }
  const error = value.error;
  return (
    value.success === false &&
    isRecord(error) &&
    hasExactKeys(error, ['code', 'message', 'retryable']) &&
    typeof error.code === 'string' &&
    ERROR_CODES.has(error.code as CliAdapterErrorCode) &&
    isBoundedString(error.message, 512) &&
    typeof error.retryable === 'boolean'
  );
}

export function isCliAdapterResponse(value: unknown): value is CliAdapterResponse {
  if (
    !isRecord(value) ||
    value.protocol !== PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION ||
    !isRequestId(value.requestId) ||
    typeof value.operation !== 'string' ||
    !OPERATIONS.has(value.operation as CliAdapterOperation)
  ) {
    return false;
  }
  if (value.success === false) return isFailure(value);
  if (
    value.success !== true ||
    !hasExactKeys(value, ['protocol', 'requestId', 'operation', 'success', 'result'])
  ) {
    return false;
  }
  switch (value.operation) {
    case 'adapter.manifest':
      return isCliAdapterManifest(value.result);
    case 'connection.resolve':
      return isResolvedConnection(value.result);
    case 'adapter.doctor':
      return isDoctorResult(value.result);
    default:
      return false;
  }
}

function parseBoundedJson(serialized: string): unknown {
  if (new TextEncoder().encode(serialized).byteLength > CLI_ADAPTER_MAX_MESSAGE_BYTES) {
    throw new Error('Panerelay CLI adapter message exceeds the protocol size limit');
  }
  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    throw new Error('Panerelay CLI adapter message is not valid JSON');
  }
}

export function parseCliAdapterRequest(serialized: string): CliAdapterRequest {
  const value = parseBoundedJson(serialized);
  if (!isCliAdapterRequest(value)) throw new Error('Invalid Panerelay CLI adapter request');
  return value;
}

export function parseCliAdapterResponse(serialized: string): CliAdapterResponse {
  const value = parseBoundedJson(serialized);
  if (!isCliAdapterResponse(value)) throw new Error('Invalid Panerelay CLI adapter response');
  return value;
}

export function serializeCliAdapterMessage(value: CliAdapterRequest | CliAdapterResponse): string {
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).byteLength > CLI_ADAPTER_MAX_MESSAGE_BYTES) {
    throw new Error('Panerelay CLI adapter message exceeds the protocol size limit');
  }
  return `${serialized}\n`;
}
