import { PANERELAY_PROTOCOL_VERSION } from './constants.js';
import {
  isAutomationActivitySnapshotMessage,
  isAutomationActivityUpdatedMessage,
  isControlSessionChangedMessage,
} from './control-activity.js';

export * from './constants.js';
export * from './cli-adapter.js';
export * from './cdp-bootstrap.js';
export * from './control-activity.js';
export * from './native-transfer.js';

export type BrowserFamily = 'chrome' | 'chromium' | 'edge' | 'unknown';

export interface BrowserCapabilities {
  cdpRelay: boolean;
}

export interface BrowserRegistration {
  browserId: string;
  browserName: string;
  extensionId: string;
  extensionVersion: string;
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

export interface CdpCommandMessage {
  type: 'cdp.command';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  requestId: string;
  targetId: string;
  method: string;
  params?: Record<string, unknown>;
  sessionId?: string;
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

export type IntegrationRequest =
  | { method: 'default-provider.get' }
  | { method: 'default-provider.set' }
  | { method: 'default-provider.clear' }
  | { method: 'browser-default.get' }
  | { method: 'browser-default.set-current' }
  | { method: 'browser-default.clear-current' }
  | { method: 'workspace.pick-directory' };

export interface IntegrationDefaultProviderResult {
  provider: string | null;
  isPanerelay: boolean;
}

export interface IntegrationWorkspaceDirectoryResult {
  path: string | null;
}

export interface IntegrationBrowserDefaultResult {
  currentBrowser: {
    browserId: string;
    browserName: string;
    browserFamily?: BrowserFamily;
  } | null;
  defaultBrowserId: string | null;
  isCurrentBrowser: boolean;
}

export type IntegrationResult =
  | IntegrationDefaultProviderResult
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
  | CdpTargetRequestMessage
  | CdpAttachMessage
  | CdpCommandMessage
  | CdpDetachMessage
  | import('./control-activity.js').ControlSessionChangedMessage
  | import('./control-activity.js').AutomationActivitySnapshotMessage
  | import('./control-activity.js').AutomationActivityUpdatedMessage
  | AgentResponseMessage
  | IntegrationResponseMessage
  | ConversationEventMessage;

export type ExtensionToHostMessage =
  | BrowserRegisterMessage
  | CdpTargetResultMessage
  | CdpTargetEventMessage
  | CdpAttachedMessage
  | CdpResultMessage
  | CdpEventMessage
  | CdpDetachedMessage
  | AgentRequestMessage
  | IntegrationRequestMessage;

export interface BridgeState {
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  pid: number;
  port: number;
  token: string;
  generation: string;
  browserId: string;
  browserName: string;
  extensionVersion: string;
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

export function isExtensionToHostMessage(value: unknown): value is ExtensionToHostMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.protocol !== PANERELAY_PROTOCOL_VERSION || typeof candidate.type !== 'string') {
    return false;
  }
  if (candidate.type === 'browser.register') {
    return (
      typeof candidate.browserId === 'string' &&
      typeof candidate.browserName === 'string' &&
      typeof candidate.extensionId === 'string' &&
      typeof candidate.extensionVersion === 'string' &&
      (candidate.browserFamily === undefined ||
        ['chrome', 'chromium', 'edge', 'unknown'].includes(candidate.browserFamily as string)) &&
      (candidate.capabilities === undefined ||
        (typeof candidate.capabilities === 'object' &&
          candidate.capabilities !== null &&
          typeof (candidate.capabilities as Record<string, unknown>).cdpRelay === 'boolean'))
    );
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
  return (
    candidate.protocol === PANERELAY_PROTOCOL_VERSION &&
    typeof candidate.type === 'string' &&
    [
      'browser.registered',
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
