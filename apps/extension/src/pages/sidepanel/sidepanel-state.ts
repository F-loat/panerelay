import type {
  AgentProviderSummary,
  ConversationApproval,
  ConversationApprovalDecision,
  ConversationEvent,
  ConversationImageInput,
  ConversationSummary,
} from '@panerelay/protocol';
import type { ConversationWorkspaceSnapshot } from '../../shared/conversation-workspaces.js';
import type { TimelineItem } from '../../shared/conversation-timeline.js';
import { DEFAULT_ACCENT_COLOR } from '../../shared/appearance.js';
import type { ExtensionStatus } from '../../shared/messages.js';
import type { PageElementComment } from '../../shared/page-comments.js';
import { defaultLocale, type Locale, type ThemeSetting } from './i18n.js';
import {
  bootstrapProviderId,
  supportedProviders,
  type ProviderBootstrap,
} from './provider-selection.js';

export type { TimelineItem } from '../../shared/conversation-timeline.js';

export type TurnFeedbackPhase = 'starting' | 'working';

export type ConversationLoadSource =
  'draft' | 'memory-cache' | 'session-snapshot' | 'provider-resume' | 'live-created';

export interface ConversationDiagnosticEvent {
  sequence: number;
  receivedAt: string;
  kind: ConversationEvent['kind'];
  conversationId?: string;
  turnId?: string;
  messageId?: string;
  itemId?: string;
  activityId?: string;
  approvalId?: string;
  phase?: 'commentary' | 'final';
  status?: string;
  deltaLength?: number;
  textLength?: number;
}

export interface ConversationDiagnosticState {
  panelInstanceId: string;
  load: {
    source: ConversationLoadSource;
    loadedAt: string;
    conversationId?: string;
  } | null;
  eventTrace: ConversationDiagnosticEvent[];
  droppedEventCount: number;
}

export interface PastedImage extends ConversationImageInput {
  id: string;
  size: number;
}

export interface SidepanelState {
  locale: Locale;
  themeSetting: ThemeSetting;
  accentColor: string;
  extensionStatus: ExtensionStatus | null;
  providers: AgentProviderSummary[];
  conversations: ConversationSummary[];
  historyOpen: boolean;
  historyLoading: boolean;
  historyError: string;
  historyLoadedProviderId: string;
  historyQuery: string;
  currentProviderId: string;
  providerDiscoveryPending: boolean;
  providerPreparations: Record<
    string,
    { status: 'idle' | 'preparing' | 'ready' | 'error'; error?: string }
  >;
  workspace: ConversationWorkspaceSnapshot | null;
  currentConversation: ConversationSummary | null;
  pageComments: PageElementComment[];
  commentMode: boolean;
  pageCommentsPending: boolean;
  pastedImages: PastedImage[];
  imageError: string;
  autoApprove: boolean;
  timeline: TimelineItem[];
  runningTurnId: string | null;
  turnFeedback: TurnFeedbackPhase | null;
  activeReasoning: { id: string; text: string } | null;
  loadingConversation: boolean;
  selectingProject: boolean;
  submitting: boolean;
  initializing: boolean;
  authorizationPending: boolean;
  fetchAuthorizationPending: boolean;
  nativeRetryPending: boolean;
  defaultProviderPending: boolean;
  browserUseDefaultPending: boolean;
  browserDefaultPending: boolean;
  controlledTabPendingId: number | null;
  settingsOpen: boolean;
  composerText: string;
  scrollRequest: number;
  error: string;
  diagnostics: ConversationDiagnosticState;
}

export type SidepanelAction =
  | { type: 'patch'; patch: Partial<SidepanelState> }
  | {
      type: 'conversation-event';
      event: ConversationEvent;
      interruptedMessage: string;
      failedMessage: string;
      diagnosticReceivedAt?: string;
    };

const MAX_DIAGNOSTIC_EVENTS = 200;

function diagnosticEvent(
  event: ConversationEvent,
  sequence: number,
  receivedAt: string,
): ConversationDiagnosticEvent {
  const base = {
    sequence,
    receivedAt,
    kind: event.kind,
    ...('conversationId' in event && event.conversationId
      ? { conversationId: event.conversationId }
      : {}),
    ...('turnId' in event && event.turnId ? { turnId: event.turnId } : {}),
  };

  switch (event.kind) {
    case 'message.delta':
      return {
        ...base,
        messageId: event.messageId,
        ...(event.phase ? { phase: event.phase } : {}),
        deltaLength: event.delta.length,
      };
    case 'message.completed':
      return {
        ...base,
        messageId: event.message.id,
        ...(event.message.phase ? { phase: event.message.phase } : {}),
        textLength: event.message.text.length,
      };
    case 'reasoning.delta':
      return { ...base, itemId: event.itemId, deltaLength: event.delta.length };
    case 'activity.updated':
      return {
        ...base,
        activityId: event.activity.id,
        status: event.activity.status,
      };
    case 'approval.requested':
      return { ...base, approvalId: event.approval.id, status: 'requested' };
    case 'approval.resolved':
      return { ...base, approvalId: event.approvalId, status: 'resolved' };
    case 'turn.completed':
      return { ...base, status: event.status };
    case 'error':
      return { ...base, textLength: event.message.length };
    case 'turn.started':
    case 'usage.updated':
      return base;
  }
}

function appendDiagnosticEvent(
  diagnostics: ConversationDiagnosticState,
  event: ConversationEvent,
  receivedAt: string,
): ConversationDiagnosticState {
  const sequence = (diagnostics.eventTrace.at(-1)?.sequence ?? 0) + 1;
  const appended = [...diagnostics.eventTrace, diagnosticEvent(event, sequence, receivedAt)];
  const overflow = Math.max(0, appended.length - MAX_DIAGNOSTIC_EVENTS);
  return {
    ...diagnostics,
    eventTrace: overflow > 0 ? appended.slice(overflow) : appended,
    droppedEventCount: diagnostics.droppedEventCount + overflow,
  };
}

export function conversationDiagnosticLoad(
  diagnostics: ConversationDiagnosticState,
  source: ConversationLoadSource,
  loadedAt: string,
  conversationId?: string,
): ConversationDiagnosticState {
  return {
    panelInstanceId: diagnostics.panelInstanceId,
    load: { source, loadedAt, ...(conversationId ? { conversationId } : {}) },
    eventTrace: [],
    droppedEventCount: 0,
  };
}

export function sidepanelRandomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function automaticApprovalDecision(
  approval: ConversationApproval,
): ConversationApprovalDecision | null {
  return approval.decisions.includes('accept') ? 'accept' : null;
}

export function createInitialSidepanelState(
  language?: string,
  bootstrap?: ProviderBootstrap,
): SidepanelState {
  const providers = bootstrap?.providers.length ? bootstrap.providers : supportedProviders([]);
  return {
    locale: defaultLocale(language),
    themeSetting: 'system',
    accentColor: DEFAULT_ACCENT_COLOR,
    extensionStatus: null,
    providers,
    conversations: [],
    historyOpen: false,
    historyLoading: false,
    historyError: '',
    historyLoadedProviderId: '',
    historyQuery: '',
    currentProviderId: bootstrapProviderId(providers, bootstrap?.preferredProviderId),
    providerDiscoveryPending: false,
    providerPreparations: {},
    workspace: null,
    currentConversation: null,
    pageComments: [],
    commentMode: false,
    pageCommentsPending: false,
    pastedImages: [],
    imageError: '',
    autoApprove: false,
    timeline: [],
    runningTurnId: null,
    turnFeedback: null,
    activeReasoning: null,
    loadingConversation: false,
    selectingProject: false,
    submitting: false,
    initializing: true,
    authorizationPending: false,
    fetchAuthorizationPending: false,
    nativeRetryPending: false,
    defaultProviderPending: false,
    browserUseDefaultPending: false,
    browserDefaultPending: false,
    controlledTabPendingId: null,
    settingsOpen: false,
    composerText: '',
    scrollRequest: 0,
    error: '',
    diagnostics: {
      panelInstanceId: sidepanelRandomId(),
      load: null,
      eventTrace: [],
      droppedEventCount: 0,
    },
  };
}

function settleStreamingMessages(timeline: TimelineItem[]): TimelineItem[] {
  let changed = false;
  const settled = timeline.map(item => {
    if (item.type !== 'message' || !item.streaming) return item;
    changed = true;
    return { ...item, streaming: false };
  });
  return changed ? settled : timeline;
}

function appendMessageDelta(
  timeline: TimelineItem[],
  event: Extract<ConversationEvent, { kind: 'message.delta' }>,
): TimelineItem[] {
  let existingIndex = -1;
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const item = timeline[index];
    if (item?.type === 'message' && item.message.id === event.messageId) {
      existingIndex = index;
      break;
    }
  }
  const settledTimeline = settleStreamingMessages(timeline);
  if (existingIndex >= 0 && existingIndex === settledTimeline.length - 1) {
    return settledTimeline.map((item, index) =>
      index === existingIndex && item.type === 'message'
        ? {
            ...item,
            streaming: true,
            turnId: event.turnId,
            message: { ...item.message, text: item.message.text + event.delta },
          }
        : item,
    );
  }
  return [
    ...settledTimeline,
    {
      type: 'message',
      ...(existingIndex >= 0 ? { segmentId: sidepanelRandomId() } : {}),
      streaming: true,
      turnId: event.turnId,
      message: {
        id: event.messageId,
        role: 'assistant',
        text: event.delta,
        ...(event.phase ? { phase: event.phase } : {}),
        createdAt: new Date().toISOString(),
      },
    },
  ];
}

function completeMessage(
  timeline: TimelineItem[],
  event: Extract<ConversationEvent, { kind: 'message.completed' }>,
): TimelineItem[] {
  const { message } = event;
  const matchingIndexes = timeline.flatMap((item, index) =>
    item.type === 'message' && item.message.id === message.id ? [index] : [],
  );
  if (matchingIndexes.length === 0) {
    return [...timeline, { type: 'message', message, turnId: event.turnId }];
  }
  if (matchingIndexes.length > 1) {
    const matching = new Set(matchingIndexes);
    return timeline.map((item, index) =>
      matching.has(index) && item.type === 'message'
        ? {
            ...item,
            streaming: false,
            turnId: event.turnId,
            message: {
              ...item.message,
              ...(message.phase ? { phase: message.phase } : {}),
            },
          }
        : item,
    );
  }
  const existingIndex = matchingIndexes[0]!;
  const existing = timeline[existingIndex];
  if (
    existing?.type === 'message' &&
    existingIndex < timeline.length - 1 &&
    message.text.startsWith(existing.message.text) &&
    message.text.length > existing.message.text.length
  ) {
    const trailingText = message.text.slice(existing.message.text.length);
    return [
      ...timeline.map((item, index) =>
        index === existingIndex && item.type === 'message'
          ? { ...item, streaming: false, turnId: event.turnId }
          : item,
      ),
      {
        type: 'message',
        segmentId: sidepanelRandomId(),
        message: { ...message, text: trailingText },
        streaming: false,
        turnId: event.turnId,
      },
    ];
  }
  return timeline.map((item, index) =>
    index === existingIndex && item.type === 'message'
      ? { ...item, message, streaming: false, turnId: event.turnId }
      : item,
  );
}

export function sidepanelReducer(
  previousState: SidepanelState,
  action: SidepanelAction,
): SidepanelState {
  if (action.type === 'patch') return { ...previousState, ...action.patch };

  let state = previousState;

  const { event } = action;
  if (
    'conversationId' in event &&
    event.conversationId &&
    event.conversationId !== state.currentConversation?.id
  ) {
    return state;
  }
  if (action.diagnosticReceivedAt) {
    state = {
      ...state,
      diagnostics: appendDiagnosticEvent(state.diagnostics, event, action.diagnosticReceivedAt),
    };
  }

  switch (event.kind) {
    case 'turn.started':
      return {
        ...state,
        timeline: settleStreamingMessages(state.timeline),
        runningTurnId: event.turnId,
        turnFeedback: 'working',
        activeReasoning: null,
      };
    case 'message.delta':
      return {
        ...state,
        timeline: appendMessageDelta(state.timeline, event),
        turnFeedback: null,
        activeReasoning: null,
      };
    case 'message.completed':
      return {
        ...state,
        timeline: completeMessage(state.timeline, event),
        turnFeedback: null,
        activeReasoning: null,
      };
    case 'reasoning.delta': {
      const settledTimeline = settleStreamingMessages(state.timeline);
      const existingIndex = settledTimeline.findIndex(
        item => item.type === 'reasoning' && item.id === event.itemId,
      );
      const timeline =
        existingIndex < 0
          ? [
              ...settledTimeline,
              {
                type: 'reasoning' as const,
                id: event.itemId,
                text: event.delta,
                turnId: event.turnId,
              },
            ]
          : settledTimeline.map((item, index) =>
              index === existingIndex && item.type === 'reasoning'
                ? { ...item, text: item.text + event.delta, turnId: event.turnId }
                : item,
            );
      const reasoning = timeline.find(
        item => item.type === 'reasoning' && item.id === event.itemId,
      );
      return {
        ...state,
        timeline,
        turnFeedback: null,
        activeReasoning:
          reasoning?.type === 'reasoning'
            ? { id: reasoning.id, text: reasoning.text }
            : { id: event.itemId, text: event.delta },
      };
    }
    case 'activity.updated': {
      const settledTimeline = settleStreamingMessages(state.timeline);
      const existingIndex = settledTimeline.findIndex(
        item => item.type === 'activity' && item.activity.id === event.activity.id,
      );
      const timeline =
        existingIndex < 0
          ? [
              ...settledTimeline,
              {
                type: 'activity' as const,
                activity: event.activity,
                turnId: event.turnId,
              },
            ]
          : settledTimeline.map((item, index) =>
              index === existingIndex && item.type === 'activity'
                ? { ...item, activity: event.activity, turnId: event.turnId }
                : item,
            );
      return { ...state, timeline, turnFeedback: null, activeReasoning: null };
    }
    case 'approval.requested':
      return {
        ...state,
        currentConversation: state.currentConversation
          ? { ...state.currentConversation, status: 'waiting' }
          : null,
        timeline: [
          ...settleStreamingMessages(state.timeline),
          { type: 'approval', approval: event.approval },
        ],
        turnFeedback: null,
        activeReasoning: null,
      };
    case 'approval.resolved':
      return {
        ...state,
        timeline: settleStreamingMessages(state.timeline).filter(
          item => item.type !== 'approval' || item.approval.id !== event.approvalId,
        ),
        turnFeedback: 'working',
        activeReasoning: null,
      };
    case 'turn.completed': {
      const timeline = [...settleStreamingMessages(state.timeline)];
      if (event.status === 'interrupted') {
        timeline.push({
          type: 'error',
          id: sidepanelRandomId(),
          message: action.interruptedMessage,
          turnId: event.turnId,
        });
      } else if (event.status === 'failed') {
        const message = event.error || action.failedMessage;
        const latest = timeline.at(-1);
        if (!(
          latest?.type === 'error' &&
          latest.turnId === event.turnId &&
          latest.message === message
        )) {
          timeline.push({
            type: 'error',
            id: sidepanelRandomId(),
            message,
            turnId: event.turnId,
          });
        }
      }
      return {
        ...state,
        currentConversation: state.currentConversation
          ? {
              ...state.currentConversation,
              status: event.status === 'failed' ? 'error' : 'idle',
            }
          : null,
        runningTurnId: null,
        timeline,
        turnFeedback: null,
        activeReasoning: null,
      };
    }
    case 'usage.updated':
      return state;
    case 'error':
      return {
        ...state,
        timeline: [
          ...settleStreamingMessages(state.timeline),
          {
            type: 'error',
            id: sidepanelRandomId(),
            message: event.message,
            ...(state.runningTurnId ? { turnId: state.runningTurnId } : {}),
          },
        ],
        turnFeedback: null,
        activeReasoning: null,
      };
  }
}
