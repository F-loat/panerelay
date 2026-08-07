import { PANERELAY_PROTOCOL_VERSION } from './constants.js';
import type { CliAdapterMode } from './cli-adapter.js';
import {
  isAutomationActivitySnapshotMessage,
  isAutomationActivityUpdatedMessage,
  isControlSessionChangedMessage,
} from './control-activity.js';
import {
  isBrowserFetchPermissionRequestMessage,
  isBrowserFetchPermissionResultMessage,
  isBrowserFetchRequestMessage,
  isBrowserFetchResultMessage,
} from './browser-fetch.js';
import {
  comparePanerelayReleaseVersions,
  isPanerelayChromiumBuildVersion,
  isPanerelayReleaseVersion,
} from './release-version.js';

export * from './constants.js';
export * from './browser-fetch.js';
export * from './cli-adapter.js';
export * from './cdp-bootstrap.js';
export * from './conversation-target.js';
export * from './control-activity.js';
export * from './native-transfer.js';
export * from './release-version.js';

export type BrowserFamily = 'chrome' | 'chromium' | 'edge' | 'unknown';

export interface BrowserCapabilities {
  cdpRelay: boolean;
  browserFetch?: boolean;
}

export interface BrowserRegistration {
  browserId: string;
  browserName: string;
  extensionId: string;
  releaseVersion: string;
  buildVersion: string;
  checkHostUpdate: boolean;
  browserFamily?: BrowserFamily;
  capabilities?: BrowserCapabilities;
}

export interface BrowserRegisterMessage extends BrowserRegistration {
  type: 'browser.register';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
}

export interface BrowserRegisteredMessage {
  type: 'browser.registered';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  browserId: string;
  hostVersion: string;
}

export const HOST_UPDATE_DETAIL_MAX_LENGTH = 240;

export type HostUpdateError =
  | 'lock-timeout'
  | 'network'
  | 'package-unavailable'
  | 'setup-failed'
  | 'timeout'
  | 'verification-failed'
  | 'unknown';

interface HostUpdateStatusBase {
  type: 'host.update.status';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  hostVersion: string;
}

export type HostUpdateStatusMessage =
  | (HostUpdateStatusBase & {
      state: 'required' | 'updating' | 'restart-pending';
      targetVersion: string;
      retryAvailable: false;
    })
  | (HostUpdateStatusBase & {
      state: 'failed';
      targetVersion: string;
      retryAvailable: true;
      error: HostUpdateError;
      detail?: string;
      manualCommand: string;
    })
  | (HostUpdateStatusBase & {
      state: 'incompatible';
      retryAvailable: false;
      reason: 'invalid-extension-release' | 'newer-host';
      targetVersion?: string;
    });

export interface HostUpdateRetryMessage {
  type: 'host.update.retry';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
}

export function nativeHostManualUpdateCommand(targetVersion: string): string {
  if (!isPanerelayReleaseVersion(targetVersion)) {
    throw new Error('A manual Native Host update requires a valid Panerelay release');
  }
  return `npx --yes @panerelay/setup@${targetVersion} update --yes`;
}

export interface CdpTargetInfo {
  targetId: string;
  type: 'page' | 'webview';
  title: string;
  url: string;
  attached: boolean;
  active: boolean;
}

export type CdpTargetOperation =
  | { kind: 'list' }
  | { kind: 'create'; url: string; active: boolean }
  | { kind: 'close'; targetId: string }
  | { kind: 'activate'; targetId: string };

export interface CdpTargetRequestMessage {
  type: 'cdp.target.request';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  operation: CdpTargetOperation;
}

export interface CdpTargetResultMessage {
  type: 'cdp.target.result';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  success: boolean;
  targets?: CdpTargetInfo[];
  target?: CdpTargetInfo;
  error?: string;
}

export type CdpTargetEventMessage =
  | {
      type: 'cdp.target.event';
      protocol: typeof PANERELAY_PROTOCOL_VERSION;
      event: 'created' | 'changed';
      target: CdpTargetInfo;
    }
  | {
      type: 'cdp.target.event';
      protocol: typeof PANERELAY_PROTOCOL_VERSION;
      event: 'destroyed';
      targetId: string;
    };

export interface CdpAttachMessage {
  type: 'cdp.attach';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  targetId: string;
}

export interface CdpAttachedMessage {
  type: 'cdp.attached';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  success: boolean;
  target?: CdpTargetInfo;
  error?: string;
}

export type AutomationEngineId = 'agent-browser' | 'browser-use' | 'playwright';

export function isAutomationEngineId(value: unknown): value is AutomationEngineId {
  return value === 'agent-browser' || value === 'browser-use' || value === 'playwright';
}

export interface CdpCommandMessage {
  type: 'cdp.command';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  targetId: string;
  method: string;
  engine?: AutomationEngineId;
  params?: Record<string, unknown>;
  sessionId?: string;
}

export interface CdpControlUpdatedMessage {
  type: 'cdp.control.updated';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  targetId: string;
  engine: AutomationEngineId | null;
}

export function isCdpControlUpdatedMessage(value: unknown): value is CdpControlUpdatedMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    hasOnlyKeys(candidate, ['type', 'protocol', 'targetId', 'engine']) &&
    candidate.type === 'cdp.control.updated' &&
    candidate.protocol === PANERELAY_PROTOCOL_VERSION &&
    typeof candidate.targetId === 'string' &&
    candidate.targetId.length > 0 &&
    candidate.targetId.length <= 256 &&
    (candidate.engine === null || isAutomationEngineId(candidate.engine))
  );
}

export interface CdpError {
  code: number;
  message: string;
  data?: unknown;
}

export interface CdpResultMessage {
  type: 'cdp.result';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  result?: unknown;
  error?: CdpError;
}

export interface CdpEventMessage {
  type: 'cdp.event';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  targetId: string;
  method: string;
  params?: Record<string, unknown>;
  sessionId?: string;
}

export interface CdpDetachMessage {
  type: 'cdp.detach';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  reason: string;
  targetId?: string;
}

export interface CdpDetachedMessage {
  type: 'cdp.detached';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  reason: string;
  scope: 'target' | 'lease';
  targetId?: string;
}

export type AgentProviderStatus = 'ready' | 'unavailable' | 'error';

export interface AgentProviderSetupGuide {
  installCommand: string;
  loginCommand?: string;
  docsUrl?: string;
}

export interface AgentProviderSummary {
  id: string;
  name: string;
  status: AgentProviderStatus;
  description: string;
  model?: string;
  setup?: AgentProviderSetupGuide;
  setupHint?: string;
  version?: string;
  capabilities?: {
    approvals?: boolean;
    imageInput?: boolean;
    interrupt?: boolean;
    listConversations?: boolean;
    resume?: boolean;
    streaming?: boolean;
  };
}

export type ConversationStatus = 'idle' | 'running' | 'waiting' | 'error';

export interface ConversationSummary {
  id: string;
  providerId: string;
  model?: string;
  title: string;
  preview: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  phase?: 'commentary' | 'final';
  createdAt: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
}

export interface ConversationPageContext {
  target?: import('./conversation-target.js').ConversationTargetHint;
  title?: string;
  url?: string;
}

export interface ConversationStartOptions {
  cwd?: string;
  initialPage?: ConversationPageContext;
}

export const CONVERSATION_MAX_IMAGES = 4;
export const CONVERSATION_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const CONVERSATION_MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
export const CONVERSATION_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export interface ConversationImageInput {
  data: string;
  mimeType: string;
  name?: string;
}

export type ConversationApprovalDecision =
  'accept' | 'acceptForSession' | 'decline' | 'declineForSession' | 'cancel';

export interface ConversationApproval {
  id: string;
  conversationId: string;
  turnId: string;
  kind: 'command' | 'file-change' | 'tool';
  title: string;
  description?: string;
  command?: string;
  cwd?: string;
  decisions: ConversationApprovalDecision[];
}

export type ConversationActivityKind =
  'command' | 'file-change' | 'browser' | 'tool' | 'web-search' | 'other';

export interface ConversationActivity {
  id: string;
  kind: ConversationActivityKind;
  title: string;
  output?: string;
  detail?: string;
  status: 'running' | 'completed' | 'failed' | 'declined';
}

export type ConversationEvent =
  | {
      kind: 'turn.started';
      conversationId: string;
      turnId: string;
    }
  | {
      kind: 'message.delta';
      conversationId: string;
      turnId: string;
      messageId: string;
      delta: string;
      phase?: 'commentary' | 'final';
    }
  | {
      kind: 'message.completed';
      conversationId: string;
      turnId: string;
      message: ConversationMessage;
    }
  | {
      kind: 'reasoning.delta';
      conversationId: string;
      turnId: string;
      itemId: string;
      delta: string;
    }
  | {
      kind: 'activity.updated';
      conversationId: string;
      turnId: string;
      activity: ConversationActivity;
    }
  | {
      kind: 'approval.requested';
      conversationId: string;
      turnId: string;
      approval: ConversationApproval;
    }
  | {
      kind: 'approval.resolved';
      conversationId: string;
      turnId: string;
      approvalId: string;
    }
  | {
      kind: 'turn.completed';
      conversationId: string;
      turnId: string;
      status: 'completed' | 'interrupted' | 'failed';
      error?: string;
    }
  | {
      kind: 'usage.updated';
      conversationId: string;
      turnId: string;
      contextUsed?: number;
      contextSize?: number;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    }
  | {
      kind: 'error';
      conversationId?: string;
      message: string;
    };

export type AgentRequest =
  | { method: 'agent.providers' }
  | { method: 'agent.prepare'; providerId: string }
  | { method: 'conversation.list'; providerId: string; cwd?: string }
  | {
      method: 'conversation.start';
      providerId: string;
      options?: ConversationStartOptions;
    }
  | { method: 'conversation.resume'; providerId: string; conversationId: string }
  | {
      method: 'conversation.send';
      providerId: string;
      conversationId: string;
      text: string;
      images?: ConversationImageInput[];
    }
  | {
      method: 'conversation.interrupt';
      providerId: string;
      conversationId: string;
      turnId: string;
    }
  | {
      method: 'conversation.respond';
      providerId: string;
      conversationId: string;
      approvalId: string;
      decision: ConversationApprovalDecision;
    };

export interface AgentRequestMessage {
  type: 'agent.request';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  request: AgentRequest;
}

export interface AgentResponseMessage {
  type: 'agent.response';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export type AutomationIntegrationId = 'agent-browser' | 'browser-use';

export type IntegrationRequest =
  | { method: 'integration.install'; integration: AutomationIntegrationId }
  | { method: 'default-provider.get' }
  | { method: 'default-provider.set' }
  | { method: 'default-provider.clear' }
  | { method: 'browser-use-default.get' }
  | { method: 'browser-use-default.set' }
  | { method: 'browser-use-default.clear' }
  | { method: 'browser-default.get' }
  | { method: 'browser-default.set-current' }
  | { method: 'browser-default.clear-current' }
  | { method: 'workspace.pick-directory' };

export interface IntegrationDefaultProviderResult {
  available: boolean;
  provider: string | null;
  isPanerelay: boolean;
}

export interface IntegrationWorkspaceDirectoryResult {
  path: string | null;
}

export interface IntegrationBrowserUseDefaultResult {
  available: boolean;
  mode: CliAdapterMode | null;
  isPanerelay: boolean;
}

export interface IntegrationInstallResult {
  integration: AutomationIntegrationId;
  installed: true;
}

export interface IntegrationBrowserDefaultResult {
  currentBrowser: {
    browserId: string;
    browserName: string;
    browserFamily?: BrowserFamily;
  } | null;
  defaultBrowserId: string | null;
  hasMultipleBrowsers: boolean;
  isCurrentBrowser: boolean;
}

export type IntegrationResult =
  | IntegrationInstallResult
  | IntegrationDefaultProviderResult
  | IntegrationBrowserUseDefaultResult
  | IntegrationWorkspaceDirectoryResult
  | IntegrationBrowserDefaultResult;

export interface IntegrationRequestMessage {
  type: 'integration.request';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  request: IntegrationRequest;
}

export interface IntegrationResponseMessage {
  type: 'integration.response';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  success: boolean;
  result?: IntegrationResult;
  error?: string;
}

export interface ConversationEventMessage {
  type: 'conversation.event';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  event: ConversationEvent;
}

export type HostToExtensionMessage =
  | BrowserRegisteredMessage
  | HostUpdateStatusMessage
  | CdpTargetRequestMessage
  | CdpAttachMessage
  | CdpCommandMessage
  | CdpControlUpdatedMessage
  | CdpDetachMessage
  | import('./control-activity.js').ControlSessionChangedMessage
  | import('./control-activity.js').AutomationActivitySnapshotMessage
  | import('./control-activity.js').AutomationActivityUpdatedMessage
  | AgentResponseMessage
  | IntegrationResponseMessage
  | ConversationEventMessage
  | import('./browser-fetch.js').BrowserFetchRequestMessage
  | import('./browser-fetch.js').BrowserFetchPermissionRequestMessage;

export type ExtensionToHostMessage =
  | BrowserRegisterMessage
  | HostUpdateRetryMessage
  | CdpTargetResultMessage
  | CdpTargetEventMessage
  | CdpAttachedMessage
  | CdpResultMessage
  | CdpEventMessage
  | CdpDetachedMessage
  | AgentRequestMessage
  | IntegrationRequestMessage
  | import('./browser-fetch.js').BrowserFetchResultMessage
  | import('./browser-fetch.js').BrowserFetchPermissionResultMessage;

export interface BridgeState {
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  pid: number;
  port: number;
  token: string;
  generation: string;
  browserId: string;
  browserName: string;
  extensionReleaseVersion: string;
  extensionBuildVersion: string;
  hostVersion: string;
  extensionId: string;
  browserFamily?: BrowserFamily;
  capabilities?: BrowserCapabilities;
  updatedAt: string;
}

export interface RelaySessionActor {
  kind: 'automation';
  name: string;
  sessionLabel?: string;
}

export interface RelaySessionCreateRequest {
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  actor: RelaySessionActor;
  initialTargetId?: string;
}

export interface RelaySessionCreated {
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  /** Opaque participant identifier used to release only this Provider connection. */
  sessionId: string;
  cdpUrl: string;
  connectExpiresAt: string;
}

export interface RelaySessionError {
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  error: string;
}

function hasOnlyKeys(candidate: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(candidate).every(key => allowed.includes(key));
}

function isHostUpdateError(value: unknown): value is HostUpdateError {
  return [
    'lock-timeout',
    'network',
    'package-unavailable',
    'setup-failed',
    'timeout',
    'verification-failed',
    'unknown',
  ].includes(value as HostUpdateError);
}

function isHostUpdateStatusMessage(value: Record<string, unknown>): boolean {
  if (
    value.protocol !== PANERELAY_PROTOCOL_VERSION ||
    value.type !== 'host.update.status' ||
    !isPanerelayReleaseVersion(value.hostVersion) ||
    typeof value.state !== 'string' ||
    typeof value.retryAvailable !== 'boolean'
  ) {
    return false;
  }
  if (value.state === 'incompatible') {
    if (
      !hasOnlyKeys(value, [
        'type',
        'protocol',
        'state',
        'hostVersion',
        'targetVersion',
        'retryAvailable',
        'reason',
      ]) ||
      value.retryAvailable !== false ||
      !['invalid-extension-release', 'newer-host'].includes(value.reason as string)
    ) {
      return false;
    }
    if (value.reason === 'invalid-extension-release') return value.targetVersion === undefined;
    return (
      isPanerelayReleaseVersion(value.targetVersion) &&
      comparePanerelayReleaseVersions(value.hostVersion, value.targetVersion) > 0
    );
  }
  if (!isPanerelayReleaseVersion(value.targetVersion)) return false;
  if (value.state === 'failed') {
    return (
      hasOnlyKeys(value, [
        'type',
        'protocol',
        'state',
        'hostVersion',
        'targetVersion',
        'retryAvailable',
        'error',
        'detail',
        'manualCommand',
      ]) &&
      value.retryAvailable === true &&
      isHostUpdateError(value.error) &&
      (value.detail === undefined ||
        (typeof value.detail === 'string' &&
          value.detail.length <= HOST_UPDATE_DETAIL_MAX_LENGTH)) &&
      value.manualCommand === nativeHostManualUpdateCommand(value.targetVersion) &&
      comparePanerelayReleaseVersions(value.hostVersion, value.targetVersion) < 0
    );
  }
  return (
    ['required', 'updating', 'restart-pending'].includes(value.state) &&
    hasOnlyKeys(value, [
      'type',
      'protocol',
      'state',
      'hostVersion',
      'targetVersion',
      'retryAvailable',
    ]) &&
    value.retryAvailable === false &&
    comparePanerelayReleaseVersions(value.hostVersion, value.targetVersion) < 0
  );
}

export function isExtensionToHostMessage(value: unknown): value is ExtensionToHostMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.protocol !== PANERELAY_PROTOCOL_VERSION || typeof candidate.type !== 'string') {
    return false;
  }
  if (candidate.type === 'browser.register') {
    return (
      hasOnlyKeys(candidate, [
        'type',
        'protocol',
        'browserId',
        'browserName',
        'extensionId',
        'releaseVersion',
        'buildVersion',
        'checkHostUpdate',
        'browserFamily',
        'capabilities',
      ]) &&
      typeof candidate.browserId === 'string' &&
      typeof candidate.browserName === 'string' &&
      typeof candidate.extensionId === 'string' &&
      isPanerelayReleaseVersion(candidate.releaseVersion) &&
      isPanerelayChromiumBuildVersion(candidate.buildVersion) &&
      typeof candidate.checkHostUpdate === 'boolean' &&
      (candidate.browserFamily === undefined ||
        ['chrome', 'chromium', 'edge', 'unknown'].includes(candidate.browserFamily as string)) &&
      (candidate.capabilities === undefined ||
        (typeof candidate.capabilities === 'object' &&
          candidate.capabilities !== null &&
          hasOnlyKeys(candidate.capabilities as Record<string, unknown>, [
            'cdpRelay',
            'browserFetch',
          ]) &&
          typeof (candidate.capabilities as Record<string, unknown>).cdpRelay === 'boolean' &&
          ((candidate.capabilities as Record<string, unknown>).browserFetch === undefined ||
            typeof (candidate.capabilities as Record<string, unknown>).browserFetch === 'boolean')))
    );
  }
  if (candidate.type === 'host.update.retry') {
    return hasOnlyKeys(candidate, ['type', 'protocol']);
  }
  if (candidate.type === 'fetch.result') return isBrowserFetchResultMessage(value);
  if (candidate.type === 'fetch.permission.result') {
    return isBrowserFetchPermissionResultMessage(value);
  }
  return [
    'cdp.target.result',
    'cdp.target.event',
    'cdp.attached',
    'cdp.result',
    'cdp.event',
    'cdp.detached',
    'agent.request',
    'integration.request',
  ].includes(candidate.type);
}

export function isHostToExtensionMessage(value: unknown): value is HostToExtensionMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.type === 'control.session.changed') {
    return isControlSessionChangedMessage(value);
  }
  if (candidate.type === 'control.activity.snapshot') {
    return isAutomationActivitySnapshotMessage(value);
  }
  if (candidate.type === 'control.activity.updated') {
    return isAutomationActivityUpdatedMessage(value);
  }
  if (candidate.type === 'cdp.control.updated') {
    return isCdpControlUpdatedMessage(value);
  }
  if (candidate.type === 'host.update.status') {
    return isHostUpdateStatusMessage(candidate);
  }
  if (candidate.type === 'browser.registered') {
    return (
      candidate.protocol === PANERELAY_PROTOCOL_VERSION &&
      typeof candidate.browserId === 'string' &&
      isPanerelayReleaseVersion(candidate.hostVersion)
    );
  }
  if (candidate.type === 'fetch.request') return isBrowserFetchRequestMessage(value);
  if (candidate.type === 'fetch.permission.request') {
    return isBrowserFetchPermissionRequestMessage(value);
  }
  return (
    candidate.protocol === PANERELAY_PROTOCOL_VERSION &&
    typeof candidate.type === 'string' &&
    [
      'cdp.target.request',
      'cdp.attach',
      'cdp.command',
      'cdp.detach',
      'agent.response',
      'integration.response',
      'conversation.event',
    ].includes(candidate.type)
  );
}
