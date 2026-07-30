import { PANERELAY_PROTOCOL_VERSION } from './constants.js';

export type ControlSessionState =
  'allocated' | 'connected' | 'active' | 'released' | 'expired' | 'failed';

export type ControlHeartbeatFreshness = 'unknown' | 'fresh' | 'stale';

export interface ControlSessionActor {
  kind: 'automation';
  name: string;
  sessionLabel?: string;
}

export interface ControlSessionSummary {
  id: string;
  actor: ControlSessionActor;
  state: ControlSessionState;
  participantCount: number;
  controlledTargetCount: number;
  heartbeatFreshness: ControlHeartbeatFreshness;
  lastHeartbeatAt?: string;
  leaseExpiresAt?: string;
  updatedAt: string;
}

export type AutomationActivityCategory =
  | 'target'
  | 'navigation'
  | 'interaction'
  | 'page-content'
  | 'browser-state'
  | 'network'
  | 'emulation'
  | 'artifact'
  | 'other';

export type AutomationActivityLabel =
  | 'manage-target'
  | 'navigate-page'
  | 'interact-with-page'
  | 'read-page'
  | 'manage-browser-state'
  | 'inspect-network'
  | 'emulate-page'
  | 'create-artifact'
  | 'run-browser-operation';

export type AutomationActivityStatus = 'started' | 'completed' | 'failed' | 'denied';

export type AutomationActivityFailure =
  'policy-denied' | 'browser-error' | 'session-ended' | 'transport-error';

export interface AutomationActivityClassification {
  category: AutomationActivityCategory;
  label: AutomationActivityLabel;
}

export interface AutomationActivity {
  id: string;
  sessionId: string;
  actor: ControlSessionActor;
  targetId?: string;
  category: AutomationActivityCategory;
  label: AutomationActivityLabel;
  status: AutomationActivityStatus;
  failure?: AutomationActivityFailure;
  sequence: number;
  startedAt: string;
  updatedAt: string;
}

export interface ControlSessionChangedMessage {
  type: 'control.session.changed';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  epoch: string;
  sequence: number;
  session: ControlSessionSummary;
}

export interface AutomationActivitySnapshotMessage {
  type: 'control.activity.snapshot';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  epoch: string;
  sequence: number;
  firstRetainedSequence?: number;
  activities: AutomationActivity[];
}

export interface AutomationActivityUpdatedMessage {
  type: 'control.activity.updated';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  epoch: string;
  sequence: number;
  activity: AutomationActivity;
}

const TARGET_METHODS = new Set([
  'Browser.getVersion',
  'Target.activateTarget',
  'Target.attachToTarget',
  'Target.closeTarget',
  'Target.createTarget',
  'Target.detachFromTarget',
  'Target.getBrowserContexts',
  'Target.getTargetInfo',
  'Target.getTargets',
  'Target.setDiscoverTargets',
]);

const NAVIGATION_METHODS = new Set([
  'Page.getNavigationHistory',
  'Page.navigate',
  'Page.navigateToHistoryEntry',
  'Page.reload',
  'Page.stopLoading',
]);

const ARTIFACT_METHODS = new Set([
  'Page.captureScreenshot',
  'Page.printToPDF',
  'Page.startScreencast',
  'Page.stopScreencast',
]);

const BROWSER_STATE_METHODS = new Set([
  'Browser.getWindowBounds',
  'Browser.getWindowForTarget',
  'Browser.setWindowBounds',
]);

const DOMAIN_CLASSIFICATIONS: Readonly<Record<string, AutomationActivityClassification>> = {
  Accessibility: { category: 'page-content', label: 'read-page' },
  Audits: { category: 'page-content', label: 'read-page' },
  CSS: { category: 'page-content', label: 'read-page' },
  DOM: { category: 'page-content', label: 'read-page' },
  DOMDebugger: { category: 'page-content', label: 'read-page' },
  DOMSnapshot: { category: 'page-content', label: 'read-page' },
  Emulation: { category: 'emulation', label: 'emulate-page' },
  Fetch: { category: 'network', label: 'inspect-network' },
  HeapProfiler: { category: 'artifact', label: 'create-artifact' },
  Input: { category: 'interaction', label: 'interact-with-page' },
  Network: { category: 'network', label: 'inspect-network' },
  Overlay: { category: 'interaction', label: 'interact-with-page' },
  Performance: { category: 'page-content', label: 'read-page' },
  Profiler: { category: 'artifact', label: 'create-artifact' },
  Runtime: { category: 'page-content', label: 'read-page' },
  Security: { category: 'network', label: 'inspect-network' },
  ServiceWorker: { category: 'network', label: 'inspect-network' },
  Storage: { category: 'browser-state', label: 'manage-browser-state' },
  Tracing: { category: 'artifact', label: 'create-artifact' },
};

const DEFAULT_CLASSIFICATION: AutomationActivityClassification = {
  category: 'other',
  label: 'run-browser-operation',
};

export function classifyCdpMethod(method: string): AutomationActivityClassification {
  if (TARGET_METHODS.has(method) || method.startsWith('Target.')) {
    return { category: 'target', label: 'manage-target' };
  }

  if (NAVIGATION_METHODS.has(method)) {
    return { category: 'navigation', label: 'navigate-page' };
  }

  if (ARTIFACT_METHODS.has(method)) {
    return { category: 'artifact', label: 'create-artifact' };
  }

  if (BROWSER_STATE_METHODS.has(method)) {
    return { category: 'browser-state', label: 'manage-browser-state' };
  }

  const separator = method.indexOf('.');
  const domain = separator > 0 ? method.slice(0, separator) : '';
  return DOMAIN_CLASSIFICATIONS[domain] ?? DEFAULT_CLASSIFICATION;
}

const SESSION_STATES = new Set<ControlSessionState>([
  'allocated',
  'connected',
  'active',
  'released',
  'expired',
  'failed',
]);

const HEARTBEAT_FRESHNESS = new Set<ControlHeartbeatFreshness>(['unknown', 'fresh', 'stale']);
const ACTIVITY_CATEGORIES = new Set<AutomationActivityCategory>([
  'target',
  'navigation',
  'interaction',
  'page-content',
  'browser-state',
  'network',
  'emulation',
  'artifact',
  'other',
]);
const ACTIVITY_LABELS = new Set<AutomationActivityLabel>([
  'manage-target',
  'navigate-page',
  'interact-with-page',
  'read-page',
  'manage-browser-state',
  'inspect-network',
  'emulate-page',
  'create-artifact',
  'run-browser-operation',
]);
const ACTIVITY_STATUSES = new Set<AutomationActivityStatus>([
  'started',
  'completed',
  'failed',
  'denied',
]);
const ACTIVITY_FAILURES = new Set<AutomationActivityFailure>([
  'policy-denied',
  'browser-error',
  'session-ended',
  'transport-error',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  return Object.keys(value).every(key => keys.has(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isSequence(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isControlSessionActor(value: unknown): value is ControlSessionActor {
  if (!isRecord(value)) return false;
  return (
    hasOnlyKeys(value, new Set(['kind', 'name', 'sessionLabel'])) &&
    value.kind === 'automation' &&
    isNonEmptyString(value.name) &&
    (value.sessionLabel === undefined || isNonEmptyString(value.sessionLabel))
  );
}

export function isControlSessionSummary(value: unknown): value is ControlSessionSummary {
  if (!isRecord(value)) return false;
  return (
    hasOnlyKeys(
      value,
      new Set([
        'id',
        'actor',
        'state',
        'participantCount',
        'controlledTargetCount',
        'heartbeatFreshness',
        'lastHeartbeatAt',
        'leaseExpiresAt',
        'updatedAt',
      ]),
    ) &&
    isNonEmptyString(value.id) &&
    isControlSessionActor(value.actor) &&
    SESSION_STATES.has(value.state as ControlSessionState) &&
    Number.isSafeInteger(value.participantCount) &&
    Number(value.participantCount) >= 0 &&
    Number.isSafeInteger(value.controlledTargetCount) &&
    Number(value.controlledTargetCount) >= 0 &&
    HEARTBEAT_FRESHNESS.has(value.heartbeatFreshness as ControlHeartbeatFreshness) &&
    (value.lastHeartbeatAt === undefined || isNonEmptyString(value.lastHeartbeatAt)) &&
    (value.leaseExpiresAt === undefined || isNonEmptyString(value.leaseExpiresAt)) &&
    isNonEmptyString(value.updatedAt)
  );
}

export function isAutomationActivity(value: unknown): value is AutomationActivity {
  if (!isRecord(value)) return false;
  return (
    hasOnlyKeys(
      value,
      new Set([
        'id',
        'sessionId',
        'actor',
        'targetId',
        'category',
        'label',
        'status',
        'failure',
        'sequence',
        'startedAt',
        'updatedAt',
      ]),
    ) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.sessionId) &&
    isControlSessionActor(value.actor) &&
    (value.targetId === undefined || isNonEmptyString(value.targetId)) &&
    ACTIVITY_CATEGORIES.has(value.category as AutomationActivityCategory) &&
    ACTIVITY_LABELS.has(value.label as AutomationActivityLabel) &&
    ACTIVITY_STATUSES.has(value.status as AutomationActivityStatus) &&
    (value.failure === undefined ||
      ACTIVITY_FAILURES.has(value.failure as AutomationActivityFailure)) &&
    isSequence(value.sequence) &&
    isNonEmptyString(value.startedAt) &&
    isNonEmptyString(value.updatedAt)
  );
}

function hasControlEnvelope(value: Record<string, unknown>): boolean {
  return (
    value.protocol === PANERELAY_PROTOCOL_VERSION &&
    isNonEmptyString(value.epoch) &&
    isSequence(value.sequence)
  );
}

export function isControlSessionChangedMessage(
  value: unknown,
): value is ControlSessionChangedMessage {
  if (!isRecord(value)) return false;
  return (
    hasOnlyKeys(value, new Set(['type', 'protocol', 'epoch', 'sequence', 'session'])) &&
    value.type === 'control.session.changed' &&
    hasControlEnvelope(value) &&
    isControlSessionSummary(value.session)
  );
}

export function isAutomationActivitySnapshotMessage(
  value: unknown,
): value is AutomationActivitySnapshotMessage {
  if (!isRecord(value)) return false;
  return (
    hasOnlyKeys(
      value,
      new Set(['type', 'protocol', 'epoch', 'sequence', 'firstRetainedSequence', 'activities']),
    ) &&
    value.type === 'control.activity.snapshot' &&
    hasControlEnvelope(value) &&
    (value.firstRetainedSequence === undefined || isSequence(value.firstRetainedSequence)) &&
    Array.isArray(value.activities) &&
    value.activities.every(isAutomationActivity)
  );
}

export function isAutomationActivityUpdatedMessage(
  value: unknown,
): value is AutomationActivityUpdatedMessage {
  if (!isRecord(value)) return false;
  return (
    hasOnlyKeys(value, new Set(['type', 'protocol', 'epoch', 'sequence', 'activity'])) &&
    value.type === 'control.activity.updated' &&
    hasControlEnvelope(value) &&
    isAutomationActivity(value.activity) &&
    value.activity.sequence === value.sequence
  );
}
