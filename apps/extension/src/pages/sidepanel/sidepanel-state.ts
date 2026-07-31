import type {
  AgentProviderSummary,
  ConversationApproval,
  ConversationApprovalDecision,
  ConversationEvent,
  ConversationImageInput,
  ConversationMessage,
  ConversationSummary,
} from '@panerelay/protocol';
import type { ConversationWorkspaceSnapshot } from '../../shared/conversation-workspaces.js';
import type { ExtensionStatus } from '../../shared/messages.js';
import type { PageElementComment } from '../../shared/page-comments.js';
import { defaultLocale, type Locale, type ThemeSetting } from './i18n.js';
import { supportedProviders } from './provider-selection.js';

export type TimelineItem =
  | { type: 'message'; message: ConversationMessage; streaming?: boolean }
  | { type: 'reasoning'; id: string; text: string }
  | { type: 'activity'; activity: import('@panerelay/protocol').ConversationActivity }
  | { type: 'approval'; approval: ConversationApproval }
  | { type: 'error'; id: string; message: string };

export type TurnFeedbackPhase = 'starting' | 'working';

export interface PastedImage extends ConversationImageInput {
  id: string;
  size: number;
}

export interface SidepanelState {
  locale: Locale;
  themeSetting: ThemeSetting;
  extensionStatus: ExtensionStatus | null;
  providers: AgentProviderSummary[];
  conversations: ConversationSummary[];
  historyOpen: boolean;
  historyLoading: boolean;
  historyError: string;
  historyLoadedProviderId: string;
  historyQuery: string;
  currentProviderId: string;
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
  nativeRetryPending: boolean;
  defaultProviderPending: boolean;
  browserDefaultPending: boolean;
  controlledTabPendingId: number | null;
  settingsOpen: boolean;
  composerText: string;
  error: string;
}

export type SidepanelAction =
  | { type: 'patch'; patch: Partial<SidepanelState> }
  | {
      type: 'conversation-event';
      event: ConversationEvent;
      interruptedMessage: string;
      failedMessage: string;
    };

export function sidepanelRandomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function automaticApprovalDecision(
  approval: ConversationApproval,
): ConversationApprovalDecision | null {
  return approval.decisions.includes('accept') ? 'accept' : null;
}

export function createInitialSidepanelState(language?: string): SidepanelState {
  return {
    locale: defaultLocale(language),
    themeSetting: 'system',
    extensionStatus: null,
    providers: supportedProviders([]),
    conversations: [],
    historyOpen: false,
    historyLoading: false,
    historyError: '',
    historyLoadedProviderId: '',
    historyQuery: '',
    currentProviderId: 'codex',
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
    nativeRetryPending: false,
    defaultProviderPending: false,
    browserDefaultPending: false,
    controlledTabPendingId: null,
    settingsOpen: false,
    composerText: '',
    error: '',
  };
}

function appendMessageDelta(
  timeline: TimelineItem[],
  event: Extract<ConversationEvent, { kind: 'message.delta' }>,
): TimelineItem[] {
  const existingIndex = timeline.findIndex(
    item => item.type === 'message' && item.message.id === event.messageId,
  );
  if (existingIndex >= 0) {
    return timeline.map((item, index) =>
      index === existingIndex && item.type === 'message'
        ? {
            ...item,
            streaming: true,
            message: { ...item.message, text: item.message.text + event.delta },
          }
        : item,
    );
  }
  return [
    ...timeline,
    {
      type: 'message',
      streaming: true,
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

function completeMessage(timeline: TimelineItem[], message: ConversationMessage): TimelineItem[] {
  const existingIndex = timeline.findIndex(
    item => item.type === 'message' && item.message.id === message.id,
  );
  if (existingIndex < 0) return [...timeline, { type: 'message', message }];
  return timeline.map((item, index) =>
    index === existingIndex && item.type === 'message'
      ? { type: 'message', message, streaming: false }
      : item,
  );
}

export function sidepanelReducer(state: SidepanelState, action: SidepanelAction): SidepanelState {
  if (action.type === 'patch') return { ...state, ...action.patch };

  const { event } = action;
  if (
    'conversationId' in event &&
    event.conversationId &&
    event.conversationId !== state.currentConversation?.id
  ) {
    return state;
  }

  switch (event.kind) {
    case 'turn.started':
      return {
        ...state,
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
        timeline: completeMessage(state.timeline, event.message),
        turnFeedback: null,
        activeReasoning: null,
      };
    case 'reasoning.delta': {
      const existingIndex = state.timeline.findIndex(
        item => item.type === 'reasoning' && item.id === event.itemId,
      );
      const timeline =
        existingIndex < 0
          ? [...state.timeline, { type: 'reasoning' as const, id: event.itemId, text: event.delta }]
          : state.timeline.map((item, index) =>
              index === existingIndex && item.type === 'reasoning'
                ? { ...item, text: item.text + event.delta }
                : item,
            );
      const activeReasoning =
        state.activeReasoning?.id === event.itemId
          ? { id: event.itemId, text: state.activeReasoning.text + event.delta }
          : { id: event.itemId, text: event.delta };
      return { ...state, timeline, turnFeedback: 'working', activeReasoning };
    }
    case 'activity.updated': {
      const existingIndex = state.timeline.findIndex(
        item => item.type === 'activity' && item.activity.id === event.activity.id,
      );
      const timeline =
        existingIndex < 0
          ? [...state.timeline, { type: 'activity' as const, activity: event.activity }]
          : state.timeline.map((item, index) =>
              index === existingIndex && item.type === 'activity'
                ? { ...item, activity: event.activity }
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
        timeline: [...state.timeline, { type: 'approval', approval: event.approval }],
        turnFeedback: null,
        activeReasoning: null,
      };
    case 'approval.resolved':
      return {
        ...state,
        timeline: state.timeline.filter(
          item => item.type !== 'approval' || item.approval.id !== event.approvalId,
        ),
        turnFeedback: 'working',
        activeReasoning: null,
      };
    case 'turn.completed': {
      const timeline = [...state.timeline];
      if (event.status === 'interrupted') {
        timeline.push({
          type: 'error',
          id: sidepanelRandomId(),
          message: action.interruptedMessage,
        });
      } else if (event.status === 'failed') {
        timeline.push({
          type: 'error',
          id: sidepanelRandomId(),
          message: event.error || action.failedMessage,
        });
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
          ...state.timeline,
          { type: 'error', id: sidepanelRandomId(), message: event.message },
        ],
        turnFeedback: null,
        activeReasoning: null,
      };
  }
}
