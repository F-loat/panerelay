import { PANERELAY_PROTOCOL_VERSION } from './constants.js';
import { isCanonicalUuid } from './conversation-target.js';
import { isAutomationEngineId, type AutomationEngineId, type RelaySessionActor } from './index.js';

export const CDP_BOOTSTRAP_MAX_REQUEST_BYTES = 16 * 1024;
export const CDP_BOOTSTRAP_DEFAULT_TICKET_TTL_MS = 30_000;
export const CDP_BOOTSTRAP_DEFAULT_CONNECTION_WINDOW_MS = 30_000;
export const CDP_BOOTSTRAP_MAX_OUTSTANDING_TICKETS = 32;

export type CdpBootstrapConnectionPolicy = 'single';
export type CdpBootstrapErrorCode =
  | 'invalid-request'
  | 'unauthorized'
  | 'browser-unavailable'
  | 'generation-changed'
  | 'unsupported'
  | 'ticket-limit'
  | 'participant-limit'
  | 'ticket-invalid'
  | 'ticket-expired'
  | 'ticket-consumed'
  | 'lane-busy'
  | 'target-unavailable';

export interface CdpBootstrapBrowserBinding {
  browserId: string;
  generation: string;
}

export interface CdpBootstrapRequest {
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  browser: CdpBootstrapBrowserBinding;
  actor: RelaySessionActor;
  engine: AutomationEngineId;
  laneKey: string;
  connectionPolicy: CdpBootstrapConnectionPolicy;
  initialTargetId?: string;
}

export interface CdpBootstrapCreated {
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  cdpUrl: string;
  expiresAt: string;
}

export interface CdpBootstrapError {
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  error: {
    code: CdpBootstrapErrorCode;
    message: string;
  };
}

export interface CdpBootstrapVersionMetadata {
  Browser: string;
  'Protocol-Version': string;
  'User-Agent': string;
  'V8-Version': string;
  'WebKit-Version': string;
  webSocketDebuggerUrl: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

export function isCdpBootstrapLaneKey(value: unknown): value is string {
  return isBoundedString(value, 128) && /^[A-Za-z0-9._:-]+$/.test(value);
}

export function isCdpBootstrapGeneration(value: unknown): value is string {
  return isBoundedString(value, 128) && /^[A-Za-z0-9._:-]+$/.test(value);
}

function isAutomationActor(value: unknown): value is RelaySessionActor {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      value.sessionLabel === undefined ? ['kind', 'name'] : ['kind', 'name', 'sessionLabel'],
    )
  ) {
    return false;
  }
  return (
    value.kind === 'automation' &&
    isBoundedString(value.name, 64) &&
    (value.sessionLabel === undefined || isBoundedString(value.sessionLabel, 128))
  );
}

export function isCdpBootstrapRequest(value: unknown): value is CdpBootstrapRequest {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      value.initialTargetId === undefined
        ? ['protocol', 'browser', 'actor', 'engine', 'laneKey', 'connectionPolicy']
        : [
            'protocol',
            'browser',
            'actor',
            'engine',
            'laneKey',
            'connectionPolicy',
            'initialTargetId',
          ],
    ) ||
    value.protocol !== PANERELAY_PROTOCOL_VERSION ||
    !isRecord(value.browser) ||
    !hasExactKeys(value.browser, ['browserId', 'generation'])
  ) {
    return false;
  }
  return (
    isBoundedString(value.browser.browserId, 128) &&
    isCdpBootstrapGeneration(value.browser.generation) &&
    isAutomationActor(value.actor) &&
    isAutomationEngineId(value.engine) &&
    isCdpBootstrapLaneKey(value.laneKey) &&
    value.connectionPolicy === 'single' &&
    (value.initialTargetId === undefined || isCanonicalUuid(value.initialTargetId))
  );
}

export function isCdpBootstrapCreated(value: unknown): value is CdpBootstrapCreated {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['protocol', 'cdpUrl', 'expiresAt']) ||
    value.protocol !== PANERELAY_PROTOCOL_VERSION ||
    !isBoundedString(value.cdpUrl, 4_096) ||
    !isBoundedString(value.expiresAt, 64) ||
    !Number.isFinite(Date.parse(value.expiresAt))
  ) {
    return false;
  }
  try {
    const url = new URL(value.cdpUrl);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
