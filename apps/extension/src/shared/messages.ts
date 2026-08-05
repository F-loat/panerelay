import type {
  AgentProviderSummary,
  AutomationIntegrationId,
  AutomationActivity,
  ConversationApprovalDecision,
  ConversationDetail,
  ConversationEvent,
  ConversationImageInput,
  ConversationSummary,
  ControlSessionSummary,
  IntegrationBrowserDefaultResult,
  IntegrationBrowserUseDefaultResult,
  IntegrationDefaultProviderResult,
} from '@panerelay/protocol';
import type { AccentPalette } from './appearance.js';
import type {
  ConversationWorkspaceChangedMessage,
  ConversationWorkspaceSnapshot,
} from './conversation-workspaces.js';
import type { PageCommentRuntimeMessage } from './page-comments.js';
import type {
  ConversationTimelineReplay,
  ConversationTimelineSnapshot,
} from './conversation-timeline.js';

export type { ConversationWorkspaceChangedMessage } from './conversation-workspaces.js';

export interface TabSummary {
  id: number;
  title: string;
  url: string;
}

export type AuthorizationMode = 'none' | 'single-tab' | 'all-tabs';
export type NativeHostState = 'connecting' | 'connected' | 'missing' | 'disconnected';
export type AuthorizationRequest = 'all-tabs';

export type DefaultProviderState = IntegrationDefaultProviderResult;

export type BrowserDefaultState = IntegrationBrowserDefaultResult;
export type BrowserUseDefaultState = IntegrationBrowserUseDefaultResult;

export interface ExtensionStatus {
  bridgeConnected: boolean;
  nativeHostState: NativeHostState;
  defaultProvider: DefaultProviderState | null;
  browserUseDefault: BrowserUseDefaultState | null;
  browserDefault: BrowserDefaultState | null;
  authorizationRequest: AuthorizationRequest | null;
  activeTab: TabSummary | null;
  authorizationMode: AuthorizationMode;
  authorizedOriginPatterns: string[];
  authorizedTab: TabSummary | null;
  controlledTab: TabSummary | null;
  controlledTabs: TabSummary[];
  controlSession: ControlSessionSummary | null;
  automationActivities: AutomationActivity[];
  automationHistoryGap: boolean;
  error?: string;
}

export type SidePanelRequest =
  | { type: 'panerelay.status.get' }
  | {
      type: 'panerelay.authorization.set';
      mode: AuthorizationMode;
    }
  | { type: 'panerelay.control.release' }
  | { type: 'panerelay.native.retry' }
  | { type: 'panerelay.integration.install'; integration: AutomationIntegrationId }
  | { type: 'panerelay.default-provider.set'; enabled: boolean }
  | { type: 'panerelay.browser-use-default.set'; enabled: boolean }
  | { type: 'panerelay.browser-use-default.refresh' }
  | { type: 'panerelay.browser-default.set'; enabled: boolean }
  | { type: 'panerelay.browser-default.refresh' }
  | { type: 'panerelay.controlled-tab.activate'; tabId: number }
  | { type: 'panerelay.controlled-tab.close'; tabId: number }
  | { type: 'panerelay.agent.providers' }
  | { type: 'panerelay.agent.prepare'; providerId: string }
  | { type: 'panerelay.workspace.get'; providerId: string }
  | {
      type: 'panerelay.workspace.reset';
      providerId: string;
      expectedRevision: string;
    }
  | {
      type: 'panerelay.workspace.pick-directory';
      expectedRevision: string;
    }
  | {
      type: 'panerelay.workspace.clear-directory';
      expectedRevision: string;
    }
  | {
      type: 'panerelay.page-comments.start';
      continuous?: boolean;
      locale?: 'en' | 'zh-CN';
      theme?: 'dark' | 'light';
      accent?: AccentPalette;
    }
  | {
      type: 'panerelay.page-comments.appearance';
      theme: 'dark' | 'light';
      accent: AccentPalette;
    }
  | { type: 'panerelay.page-comments.stop' }
  | { type: 'panerelay.page-comments.edit'; commentId: string }
  | { type: 'panerelay.page-comments.remove'; commentId: string }
  | { type: 'panerelay.page-comments.clear' }
  | { type: 'panerelay.conversation.list'; providerId: string }
  | {
      type: 'panerelay.conversation-timeline.load';
      providerId: string;
      conversationId: string;
    }
  | {
      type: 'panerelay.conversation-timeline.save';
      snapshot: ConversationTimelineSnapshot;
    }
  | {
      type: 'panerelay.conversation.resume';
      providerId: string;
      conversationId: string;
      expectedRevision: string;
    }
  | {
      type: 'panerelay.conversation.send';
      providerId: string;
      conversationId?: string;
      expectedRevision: string;
      text: string;
      images?: ConversationImageInput[];
    }
  | {
      type: 'panerelay.conversation.interrupt';
      providerId: string;
      conversationId: string;
      turnId: string;
    }
  | {
      type: 'panerelay.conversation.respond';
      providerId: string;
      conversationId: string;
      approvalId: string;
      decision: ConversationApprovalDecision;
    };

export interface StatusChangedMessage {
  type: 'panerelay.status.changed';
  status: ExtensionStatus;
}

export interface ConversationChangedMessage {
  type: 'panerelay.conversation.event';
  event: ConversationEvent;
  timelineSequence?: number;
}

export interface SidePanelSuccessResponse {
  success: true;
  status?: ExtensionStatus;
  providers?: AgentProviderSummary[];
  conversations?: ConversationSummary[];
  conversation?: ConversationDetail;
  timeline?: ConversationTimelineReplay;
  turnId?: string;
  workspace?: ConversationWorkspaceSnapshot;
}

export interface SidePanelErrorResponse {
  success: false;
  error: string;
}

export type SidePanelResponse = SidePanelSuccessResponse | SidePanelErrorResponse;

export type SidePanelRuntimeMessage =
  | StatusChangedMessage
  | ConversationChangedMessage
  | ConversationWorkspaceChangedMessage
  | PageCommentRuntimeMessage;
