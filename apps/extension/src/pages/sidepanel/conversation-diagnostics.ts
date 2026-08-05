import type { SidepanelState, TimelineItem } from './sidepanel-state.js';
import type { ExtensionStatus, TabSummary } from '../../shared/messages.js';

export const CONVERSATION_DIAGNOSTICS_SCHEMA = 'panerelay.conversation-diagnostics' as const;
export const CONVERSATION_DIAGNOSTICS_VERSION = 3 as const;

function textSummary(text: string) {
  return {
    characterCount: text.length,
    lineCount: text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length,
  };
}

function tabEntry(tab: TabSummary | null | undefined) {
  return tab ? { id: tab.id, title: tab.title, url: tab.url } : null;
}

function browserContext(status: ExtensionStatus | null) {
  if (!status) return null;
  return {
    activeTab: tabEntry(status.activeTab),
    authorization: {
      mode: status.authorizationMode,
      originPatterns: [...status.authorizedOriginPatterns],
      tab: tabEntry(status.authorizedTab),
    },
    control: {
      tab: tabEntry(status.controlledTab),
      tabs: status.controlledTabs.map(tabEntry),
      session: status.controlSession
        ? {
            ...status.controlSession,
            actor: { ...status.controlSession.actor },
          }
        : null,
      historyGap: status.automationHistoryGap,
      activities: status.automationActivities.map(activity => ({
        ...activity,
        actor: { ...activity.actor },
      })),
    },
  };
}

function timelineEntry(item: TimelineItem, index: number) {
  switch (item.type) {
    case 'message':
      return {
        index,
        type: item.type,
        id: item.message.id,
        ...(item.segmentId ? { segmentId: item.segmentId } : {}),
        role: item.message.role,
        text: item.message.text,
        ...(item.turnId ? { turnId: item.turnId } : {}),
        ...(item.message.phase ? { phase: item.message.phase } : {}),
        createdAt: item.message.createdAt,
        streaming: Boolean(item.streaming),
      };
    case 'reasoning':
      return {
        index,
        type: item.type,
        id: item.id,
        ...(item.turnId ? { turnId: item.turnId } : {}),
        textSummary: textSummary(item.text),
      };
    case 'activity':
      return {
        index,
        type: item.type,
        id: item.activity.id,
        kind: item.activity.kind,
        title: item.activity.title,
        status: item.activity.status,
        ...(item.turnId ? { turnId: item.turnId } : {}),
        ...(item.activity.output ? { outputSummary: textSummary(item.activity.output) } : {}),
        ...(item.activity.detail ? { detailSummary: textSummary(item.activity.detail) } : {}),
      };
    case 'approval':
      return {
        index,
        type: item.type,
        id: item.approval.id,
        conversationId: item.approval.conversationId,
        turnId: item.approval.turnId,
        kind: item.approval.kind,
        title: item.approval.title,
        ...(item.approval.description ? { description: item.approval.description } : {}),
        ...(item.approval.command ? { command: item.approval.command } : {}),
        ...(item.approval.cwd ? { cwd: item.approval.cwd } : {}),
        decisions: [...item.approval.decisions],
      };
    case 'error':
      return {
        index,
        type: item.type,
        id: item.id,
        message: item.message,
        ...(item.turnId ? { turnId: item.turnId } : {}),
      };
  }
}

export function hasConversationDiagnostics(state: SidepanelState): boolean {
  return Boolean(state.currentConversation || state.timeline.length > 0);
}

export function conversationDiagnosticsRecord(state: SidepanelState, capturedAt: string) {
  const provider = state.providers.find(item => item.id === state.currentProviderId);
  const preparation = state.providerPreparations[state.currentProviderId];
  const workspace = state.workspace;
  const conversation = state.currentConversation;

  return {
    schema: CONVERSATION_DIAGNOSTICS_SCHEMA,
    version: CONVERSATION_DIAGNOSTICS_VERSION,
    capturedAt,
    locale: state.locale,
    contentPolicy: {
      messageText: 'full',
      reasoningText: 'metrics-only',
      activityOutput: 'metrics-only',
      tabMetadata: 'full',
      automationActivity: 'metadata-only',
    },
    browserContext: browserContext(state.extensionStatus),
    provider: provider
      ? {
          id: provider.id,
          name: provider.name,
          status: provider.status,
          ...(provider.version ? { version: provider.version } : {}),
          ...(provider.model ? { defaultModel: provider.model } : {}),
          ...(provider.capabilities ? { capabilities: { ...provider.capabilities } } : {}),
        }
      : { id: state.currentProviderId },
    providerPreparation: preparation
      ? {
          status: preparation.status,
          ...(preparation.error ? { error: preparation.error } : {}),
        }
      : null,
    workspace: workspace
      ? {
          kind: workspace.kind,
          providerId: workspace.providerId,
          revision: workspace.revision,
          ...(workspace.kind === 'conversation'
            ? { conversationId: workspace.conversationId }
            : {}),
          ...(workspace.cwd ? { cwd: workspace.cwd } : {}),
        }
      : null,
    conversation: conversation
      ? {
          id: conversation.id,
          providerId: conversation.providerId,
          ...(conversation.model ? { model: conversation.model } : {}),
          title: conversation.title,
          preview: conversation.preview,
          status: conversation.status,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        }
      : null,
    view: {
      timelineLength: state.timeline.length,
      runningTurnId: state.runningTurnId,
      turnFeedback: state.turnFeedback,
      activeReasoningId: state.activeReasoning?.id ?? null,
      loadingConversation: state.loadingConversation,
      submitting: state.submitting,
      initializing: state.initializing,
      error: state.error || null,
    },
    capture: {
      panelInstanceId: state.diagnostics.panelInstanceId,
      load: state.diagnostics.load,
      eventTraceDropped: state.diagnostics.droppedEventCount,
      eventTrace: state.diagnostics.eventTrace.map(event => ({ ...event })),
    },
    timeline: state.timeline.map(timelineEntry),
  };
}

export function serializeConversationDiagnostics(
  state: SidepanelState,
  capturedAt = new Date().toISOString(),
): string {
  return JSON.stringify(conversationDiagnosticsRecord(state, capturedAt), null, 2);
}
