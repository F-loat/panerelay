import type {
  AgentProviderSummary,
  AutomationActivity,
  ConversationApprovalDecision,
  ConversationDetail,
  ConversationEvent,
  ConversationSummary,
  ControlSessionSummary,
} from '@panerelay/protocol';
import type {
  ConversationWorkspaceChangedMessage,
  ConversationWorkspaceSnapshot,
} from './conversation-workspaces.js';

export type { ConversationWorkspaceChangedMessage } from './conversation-workspaces.js';

export interface TabSummary {
  id: number;
  title: string;
  url: string;
}

export type AuthorizationMode = 'none' | 'single-tab' | 'all-tabs';

export interface ExtensionStatus {
  bridgeConnected: boolean;
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
  | { type: 'panerelay.agent.providers' }
  | { type: 'panerelay.agent.prepare'; providerId: string }
  | { type: 'panerelay.workspace.get'; providerId: string }
  | {
      type: 'panerelay.workspace.reset';
      providerId: string;
      expectedRevision: string;
    }
  | { type: 'panerelay.conversation.list'; providerId: string }
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
}

export interface SidePanelSuccessResponse {
  success: true;
  status?: ExtensionStatus;
  providers?: AgentProviderSummary[];
  conversations?: ConversationSummary[];
  conversation?: ConversationDetail;
  turnId?: string;
  workspace?: ConversationWorkspaceSnapshot;
}

export interface SidePanelErrorResponse {
  success: false;
  error: string;
}

export type SidePanelResponse = SidePanelSuccessResponse | SidePanelErrorResponse;

export type SidePanelRuntimeMessage =
  StatusChangedMessage | ConversationChangedMessage | ConversationWorkspaceChangedMessage;
