import {
  CONVERSATION_IMAGE_MIME_TYPES,
  CONVERSATION_MAX_IMAGE_BYTES,
  CONVERSATION_MAX_IMAGES,
  CONVERSATION_MAX_TOTAL_IMAGE_BYTES,
  AgentProviderSummary,
  ConversationApproval,
  ConversationApprovalDecision,
  ConversationDetail,
  ConversationEvent,
  type ConversationImageInput,
  ConversationMessage,
  ConversationSummary,
} from '@panerelay/protocol';
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { ALL_WEB_ORIGIN_PATTERNS, originAuthorizationForUrl } from '../../shared/authorization.js';
import type { ConversationWorkspaceSnapshot } from '../../shared/conversation-workspaces.js';
import type { AuthorizationMode, ExtensionStatus } from '../../shared/messages.js';
import type { PageElementComment } from '../../shared/page-comments.js';
import {
  defaultLocale,
  formatCopy,
  LOCALE_KEY,
  type Locale,
  PROVIDER_KEY,
  THEME_KEY,
  type ThemeSetting,
  translate,
} from './i18n.js';
import {
  conversationProviderId,
  selectProviderId,
  supportedProviders,
} from './provider-selection.js';
import type { SidepanelClient } from './sidepanel-client.js';
import { appendPageCommentsContext, pageCommentsDisplayMessage } from './page-comment-context.js';

export type TimelineItem =
  | { type: 'message'; message: ConversationMessage; streaming?: boolean }
  | { type: 'reasoning'; id: string; text: string }
  | { type: 'activity'; activity: import('@panerelay/protocol').ConversationActivity }
  | { type: 'approval'; approval: ConversationApproval }
  | { type: 'error'; id: string; message: string };

export type TurnFeedbackPhase = 'starting' | 'working';
export const AUTO_APPROVE_KEY = 'panerelay.agentAutoApprove';
const SUPPORTED_IMAGE_MIME_TYPES = new Set<string>(CONVERSATION_IMAGE_MIME_TYPES);

export interface PastedImage extends ConversationImageInput {
  id: string;
  size: number;
}

function readImageData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      if (comma < 0) reject(new Error('Image data could not be read'));
      else resolve(result.slice(comma + 1));
    });
    reader.addEventListener('error', () => reject(reader.error || new Error('Image read failed')));
    reader.readAsDataURL(file);
  });
}

export function automaticApprovalDecision(
  approval: ConversationApproval,
): ConversationApprovalDecision | null {
  return approval.decisions.includes('accept') ? 'accept' : null;
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
  controlledTabPendingId: number | null;
  settingsOpen: boolean;
  composerText: string;
  error: string;
}

type SidepanelAction =
  | { type: 'patch'; patch: Partial<SidepanelState> }
  | {
      type: 'conversation-event';
      event: ConversationEvent;
      interruptedMessage: string;
      failedMessage: string;
    };

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
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
        timeline.push({ type: 'error', id: randomId(), message: action.interruptedMessage });
      } else if (event.status === 'failed') {
        timeline.push({
          type: 'error',
          id: randomId(),
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
        timeline: [...state.timeline, { type: 'error', id: randomId(), message: event.message }],
        turnFeedback: null,
        activeReasoning: null,
      };
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '');
}

export interface SidepanelController {
  state: SidepanelState;
  initialize(): Promise<void>;
  setProvider(providerId: string): Promise<void>;
  selectConversation(conversationId: string): Promise<void>;
  newConversation(): Promise<void>;
  setHistoryOpen(open: boolean): Promise<void>;
  setHistoryQuery(query: string): void;
  refreshHistory(): Promise<void>;
  retryProviderPreparation(): Promise<void>;
  setAuthorization(mode: AuthorizationMode): Promise<void>;
  retryNativeHost(): Promise<void>;
  setDefaultProvider(enabled: boolean): Promise<void>;
  activateControlledTab(tabId: number): Promise<void>;
  closeControlledTab(tabId: number): Promise<void>;
  setComposerText(text: string): void;
  selectProject(): Promise<void>;
  clearProject(): Promise<void>;
  togglePageComments(): Promise<void>;
  startContinuousPageComments(): Promise<void>;
  editPageComment(commentId: string): Promise<void>;
  removePageComment(commentId: string): Promise<void>;
  addPastedImages(files: File[]): Promise<void>;
  removePastedImage(imageId: string): void;
  setAutoApprove(enabled: boolean): Promise<void>;
  useSuggestion(kind: 'summarize' | 'inspect' | 'find'): void;
  sendMessage(text?: string): Promise<void>;
  interrupt(): Promise<void>;
  respondToApproval(
    approval: ConversationApproval,
    decision: ConversationApprovalDecision,
  ): Promise<void>;
  setLocale(locale: Locale): Promise<void>;
  setTheme(theme: ThemeSetting): Promise<void>;
  setSettingsOpen(open: boolean): void;
  dismissError(): void;
}

export function useSidepanelController(client: SidepanelClient): SidepanelController {
  const [state, dispatch] = useReducer(sidepanelReducer, undefined, () =>
    createInitialSidepanelState(),
  );
  const stateRef = useRef(state);
  const activationGenerationRef = useRef(0);
  const pastedImageGenerationRef = useRef(0);
  const autoApprovingApprovalIdsRef = useRef(new Set<string>());
  const conversationViewsRef = useRef(
    new Map<
      string,
      {
        conversation: ConversationSummary;
        timeline: TimelineItem[];
        runningTurnId: string | null;
        turnFeedback: TurnFeedbackPhase | null;
        activeReasoning: { id: string; text: string } | null;
      }
    >(),
  );
  const draftTextRef = useRef(new Map<string, string>());

  const conversationKey = (providerId: string, conversationId: string) =>
    `${providerId}:${conversationId}`;

  const commit = useCallback((action: SidepanelAction) => {
    const next = sidepanelReducer(stateRef.current, action);
    stateRef.current = next;
    if (next.currentConversation) {
      conversationViewsRef.current.set(
        conversationKey(next.currentConversation.providerId, next.currentConversation.id),
        {
          conversation: next.currentConversation,
          timeline: next.timeline,
          runningTurnId: next.runningTurnId,
          turnFeedback: next.turnFeedback,
          activeReasoning: next.activeReasoning,
        },
      );
    } else if (next.workspace?.kind === 'draft') {
      draftTextRef.current.set(next.workspace.revision, next.composerText);
    }
    dispatch(action);
  }, []);

  const patch = useCallback(
    (next: Partial<SidepanelState>) => commit({ type: 'patch', patch: next }),
    [commit],
  );

  const loadConversation = useCallback(
    (detail: ConversationDetail, workspace?: ConversationWorkspaceSnapshot) => {
      patch({
        ...(workspace ? { workspace, currentProviderId: workspace.providerId } : {}),
        currentConversation: detail.conversation,
        timeline: detail.messages.map(message => ({ type: 'message', message })),
        runningTurnId:
          detail.conversation.status === 'running' ? stateRef.current.runningTurnId : null,
        turnFeedback: null,
        activeReasoning: null,
        loadingConversation: false,
        error: '',
      });
    },
    [patch],
  );

  const prepareProvider = useCallback(
    async (providerId: string, force = false) => {
      const provider = stateRef.current.providers.find(item => item.id === providerId);
      if (provider?.status !== 'ready') return;
      const current = stateRef.current.providerPreparations[providerId];
      if (!force && (current?.status === 'preparing' || current?.status === 'ready')) return;
      patch({
        providerPreparations: {
          ...stateRef.current.providerPreparations,
          [providerId]: { status: 'preparing' },
        },
      });
      try {
        await client.request({ type: 'panerelay.agent.prepare', providerId });
        const providerResponse = await client.request({ type: 'panerelay.agent.providers' });
        patch({
          providers: supportedProviders(providerResponse.providers ?? stateRef.current.providers),
          providerPreparations: {
            ...stateRef.current.providerPreparations,
            [providerId]: { status: 'ready' },
          },
        });
      } catch (error) {
        patch({
          providerPreparations: {
            ...stateRef.current.providerPreparations,
            [providerId]: { status: 'error', error: errorText(error) },
          },
        });
      }
    },
    [client, patch],
  );

  const activateWorkspace = useCallback(
    async (workspace: ConversationWorkspaceSnapshot, generation: number) => {
      if (generation !== activationGenerationRef.current) return;
      pastedImageGenerationRef.current += 1;
      const provider = stateRef.current.providers.find(item => item.id === workspace.providerId);
      if (provider?.status === 'ready') void prepareProvider(workspace.providerId);

      if (workspace.kind === 'draft') {
        patch({
          workspace,
          currentProviderId: workspace.providerId,
          currentConversation: null,
          timeline: [],
          runningTurnId: null,
          turnFeedback: null,
          activeReasoning: null,
          loadingConversation: false,
          submitting: false,
          composerText: draftTextRef.current.get(workspace.revision) ?? '',
          pastedImages: [],
          imageError: '',
          error: '',
        });
        return;
      }

      const key = conversationKey(workspace.providerId, workspace.conversationId);
      const cached = conversationViewsRef.current.get(key);
      if (cached) {
        patch({
          workspace,
          currentProviderId: workspace.providerId,
          currentConversation: cached.conversation,
          timeline: cached.timeline,
          runningTurnId: cached.runningTurnId,
          turnFeedback: cached.turnFeedback,
          activeReasoning: cached.activeReasoning,
          loadingConversation: false,
          submitting: false,
          composerText: '',
          pastedImages: [],
          imageError: '',
          error: '',
        });
        return;
      }

      patch({
        workspace,
        currentProviderId: workspace.providerId,
        currentConversation: null,
        timeline: [],
        runningTurnId: null,
        turnFeedback: null,
        activeReasoning: null,
        loadingConversation: provider?.status === 'ready',
        submitting: false,
        composerText: '',
        pastedImages: [],
        imageError: '',
      });
      if (provider?.status !== 'ready') return;
      try {
        const response = await client.request({
          type: 'panerelay.conversation.resume',
          providerId: workspace.providerId,
          conversationId: workspace.conversationId,
          expectedRevision: workspace.revision,
        });
        if (generation !== activationGenerationRef.current) return;
        if (!response.conversation) throw new Error('Panerelay did not load the conversation');
        loadConversation(response.conversation, response.workspace ?? workspace);
      } catch (error) {
        if (generation === activationGenerationRef.current) {
          patch({ loadingConversation: false, error: errorText(error) });
        }
      }
    },
    [client, loadConversation, patch, prepareProvider],
  );

  const restoreWorkspace = useCallback(
    async (workspace?: ConversationWorkspaceSnapshot | null) => {
      const generation = ++activationGenerationRef.current;
      try {
        const resolved =
          workspace ??
          (
            await client.request({
              type: 'panerelay.workspace.get',
              providerId: stateRef.current.currentProviderId,
            })
          ).workspace;
        if (!resolved) throw new Error('Panerelay did not provide a tab workspace');
        await activateWorkspace(resolved, generation);
      } catch (error) {
        if (generation === activationGenerationRef.current) {
          patch({ loadingConversation: false, initializing: false, error: errorText(error) });
        }
      }
    },
    [activateWorkspace, client, patch],
  );

  const refreshHistory = useCallback(async () => {
    const providerId = stateRef.current.currentProviderId;
    const provider = stateRef.current.providers.find(item => item.id === providerId);
    if (provider?.status !== 'ready') return;
    patch({ historyLoading: true, historyError: '' });
    try {
      const response = await client.request({
        type: 'panerelay.conversation.list',
        providerId,
        ...(stateRef.current.workspace?.cwd ? { cwd: stateRef.current.workspace.cwd } : {}),
      });
      if (stateRef.current.currentProviderId !== providerId) return;
      patch({
        conversations: response.conversations ?? [],
        historyLoadedProviderId: providerId,
      });
    } catch (error) {
      if (stateRef.current.currentProviderId === providerId) {
        patch({ historyError: errorText(error) });
      }
    } finally {
      if (stateRef.current.currentProviderId === providerId) {
        patch({ historyLoading: false });
      }
    }
  }, [client, patch]);

  const initialize = useCallback(async () => {
    patch({ initializing: true, error: '' });
    let providerDiscoveryCompleted = false;
    try {
      const stored = await client.getStored([
        LOCALE_KEY,
        PROVIDER_KEY,
        THEME_KEY,
        AUTO_APPROVE_KEY,
      ]);
      const locale =
        stored[LOCALE_KEY] === 'en' || stored[LOCALE_KEY] === 'zh-CN'
          ? stored[LOCALE_KEY]
          : stateRef.current.locale;
      const themeSetting =
        stored[THEME_KEY] === 'system' ||
        stored[THEME_KEY] === 'dark' ||
        stored[THEME_KEY] === 'light'
          ? stored[THEME_KEY]
          : stateRef.current.themeSetting;
      patch({ locale, themeSetting, autoApprove: stored[AUTO_APPROVE_KEY] === true });

      const statusResponse = await client.request({ type: 'panerelay.status.get' });
      const extensionStatus = statusResponse.status ?? null;
      patch({ extensionStatus });
      const preferred =
        typeof stored[PROVIDER_KEY] === 'string'
          ? stored[PROVIDER_KEY]
          : stateRef.current.currentProviderId;
      if (!extensionStatus?.bridgeConnected) {
        const providers = supportedProviders([]);
        patch({ providers, currentProviderId: selectProviderId(providers, preferred) });
        return;
      }

      const providerResponse = await client.request({ type: 'panerelay.agent.providers' });
      const providers = supportedProviders(providerResponse.providers ?? []);
      providerDiscoveryCompleted = true;
      const currentProviderId = selectProviderId(providers, preferred);
      patch({ providers, currentProviderId, providerPreparations: {} });
      const generation = ++activationGenerationRef.current;
      const workspaceResponse = await client.request({
        type: 'panerelay.workspace.get',
        providerId: currentProviderId,
      });
      if (!workspaceResponse.workspace) {
        throw new Error('Panerelay did not provide a tab workspace');
      }
      await activateWorkspace(workspaceResponse.workspace, generation);
    } catch (error) {
      const providers = supportedProviders(
        providerDiscoveryCompleted ? stateRef.current.providers : [],
      );
      patch({
        providers,
        currentProviderId: selectProviderId(providers, stateRef.current.currentProviderId),
        error: errorText(error),
      });
    } finally {
      patch({ initializing: false });
    }
  }, [activateWorkspace, client, patch]);

  const interruptCurrent = useCallback(async () => {
    const current = stateRef.current;
    if (!current.currentConversation || !current.runningTurnId) return;
    await client.request({
      type: 'panerelay.conversation.interrupt',
      providerId: conversationProviderId(current.currentConversation, current.currentProviderId),
      conversationId: current.currentConversation.id,
      turnId: current.runningTurnId,
    });
  }, [client]);

  const setProvider = useCallback(
    async (providerId: string) => {
      await client.setStored({ [PROVIDER_KEY]: providerId });
      const previousWorkspace = stateRef.current.workspace;
      try {
        await interruptCurrent();
        let workspace = previousWorkspace;
        if (!workspace) {
          workspace =
            (await client.request({ type: 'panerelay.workspace.get', providerId })).workspace ??
            null;
        }
        if (!workspace) throw new Error('Panerelay did not provide a tab workspace');
        const generation = ++activationGenerationRef.current;
        patch({
          historyOpen: false,
          historyError: '',
          historyLoadedProviderId: '',
          historyQuery: '',
          conversations: [],
          loadingConversation: true,
          turnFeedback: null,
          activeReasoning: null,
        });
        const response = await client.request({
          type: 'panerelay.workspace.reset',
          providerId,
          expectedRevision: workspace.revision,
        });
        if (generation !== activationGenerationRef.current) return;
        if (!response.workspace) throw new Error('Panerelay did not reset the tab workspace');
        await activateWorkspace(response.workspace, generation);
      } catch (error) {
        patch({ error: errorText(error) });
      }
    },
    [activateWorkspace, client, interruptCurrent, patch],
  );

  const selectConversation = useCallback(
    async (conversationId: string) => {
      const workspace = stateRef.current.workspace;
      if (!conversationId || !workspace) return;
      const selectedProviderId =
        stateRef.current.conversations.find(item => item.id === conversationId)?.providerId ??
        stateRef.current.currentProviderId;
      const generation = ++activationGenerationRef.current;
      patch({
        loadingConversation: true,
        historyError: '',
        turnFeedback: null,
        activeReasoning: null,
      });
      try {
        const response = await client.request({
          type: 'panerelay.conversation.resume',
          providerId: selectedProviderId,
          conversationId,
          expectedRevision: workspace.revision,
        });
        if (generation !== activationGenerationRef.current) return;
        if (!response.conversation || !response.workspace) {
          throw new Error('Panerelay did not load the conversation');
        }
        loadConversation(response.conversation, response.workspace);
        patch({ historyOpen: false, historyQuery: '' });
      } catch (error) {
        if (generation === activationGenerationRef.current) {
          patch({ loadingConversation: false, historyError: errorText(error) });
        }
      }
    },
    [client, loadConversation, patch],
  );

  const newConversation = useCallback(async () => {
    const workspace = stateRef.current.workspace;
    if (!workspace) return;
    patch({ turnFeedback: null, activeReasoning: null });
    try {
      await interruptCurrent();
      const generation = ++activationGenerationRef.current;
      const response = await client.request({
        type: 'panerelay.workspace.reset',
        providerId: stateRef.current.currentProviderId,
        expectedRevision: workspace.revision,
      });
      if (generation !== activationGenerationRef.current) return;
      if (!response.workspace) throw new Error('Panerelay did not reset the tab workspace');
      await activateWorkspace(response.workspace, generation);
      patch({ historyOpen: false, historyQuery: '' });
    } catch (error) {
      patch({ error: errorText(error) });
    }
  }, [activateWorkspace, client, interruptCurrent, patch]);

  const setHistoryOpen = useCallback(
    async (historyOpen: boolean) => {
      patch({ historyOpen, ...(historyOpen ? {} : { historyQuery: '' }) });
      if (
        historyOpen &&
        stateRef.current.historyLoadedProviderId !== stateRef.current.currentProviderId
      ) {
        await refreshHistory();
      }
    },
    [patch, refreshHistory],
  );

  const setHistoryQuery = useCallback((historyQuery: string) => patch({ historyQuery }), [patch]);

  const retryProviderPreparation = useCallback(
    async () => prepareProvider(stateRef.current.currentProviderId, true),
    [prepareProvider],
  );

  const setAuthorization = useCallback(
    async (mode: AuthorizationMode) => {
      if (stateRef.current.authorizationPending) return;
      patch({ authorizationPending: true });
      try {
        if (mode === 'all-tabs') {
          const granted = await client.requestOrigins([...ALL_WEB_ORIGIN_PATTERNS]);
          if (!granted) {
            throw new Error(translate(stateRef.current.locale, 'chromeAccessDeniedAll'));
          }
        } else if (mode === 'single-tab') {
          const authorization = originAuthorizationForUrl(
            stateRef.current.extensionStatus?.activeTab?.url || '',
          );
          if (!authorization) {
            throw new Error(translate(stateRef.current.locale, 'unsupportedBrowserPage'));
          }
          const granted = await client.requestOrigins([authorization.permissionPattern]);
          if (!granted) {
            throw new Error(
              `${translate(stateRef.current.locale, 'chromeAccessDeniedSite')}: ${
                authorization.origin
              }`,
            );
          }
        }
        const response = await client.request({ type: 'panerelay.authorization.set', mode });
        patch({ extensionStatus: response.status ?? stateRef.current.extensionStatus, error: '' });
      } catch (error) {
        patch({ error: errorText(error) });
      } finally {
        patch({ authorizationPending: false });
      }
    },
    [client, patch],
  );

  const retryNativeHost = useCallback(async () => {
    if (stateRef.current.nativeRetryPending) return;
    patch({ nativeRetryPending: true, error: '' });
    try {
      const response = await client.request({ type: 'panerelay.native.retry' });
      patch({ extensionStatus: response.status ?? stateRef.current.extensionStatus });
    } catch (error) {
      patch({ error: errorText(error) });
    } finally {
      patch({ nativeRetryPending: false });
    }
  }, [client, patch]);

  const setDefaultProvider = useCallback(
    async (enabled: boolean) => {
      if (stateRef.current.defaultProviderPending) return;
      patch({ defaultProviderPending: true, error: '' });
      try {
        const response = await client.request({
          type: 'panerelay.default-provider.set',
          enabled,
        });
        patch({ extensionStatus: response.status ?? stateRef.current.extensionStatus });
      } catch (error) {
        patch({ error: errorText(error) });
      } finally {
        patch({ defaultProviderPending: false });
      }
    },
    [client, patch],
  );

  const activateControlledTab = useCallback(
    async (tabId: number) => {
      try {
        await client.request({ type: 'panerelay.controlled-tab.activate', tabId });
      } catch (error) {
        patch({ error: errorText(error) });
      }
    },
    [client, patch],
  );

  const closeControlledTab = useCallback(
    async (tabId: number) => {
      if (stateRef.current.controlledTabPendingId !== null) return;
      patch({ controlledTabPendingId: tabId, error: '' });
      try {
        await client.request({ type: 'panerelay.controlled-tab.close', tabId });
      } catch (error) {
        patch({ error: errorText(error) });
      } finally {
        patch({ controlledTabPendingId: null });
      }
    },
    [client, patch],
  );

  const setComposerText = useCallback((composerText: string) => patch({ composerText }), [patch]);

  const selectProject = useCallback(async () => {
    const workspace = stateRef.current.workspace;
    if (!workspace || workspace.kind !== 'draft' || stateRef.current.selectingProject) return;
    const generation = activationGenerationRef.current;
    patch({ selectingProject: true, error: '' });
    try {
      const response = await client.request({
        type: 'panerelay.workspace.pick-directory',
        expectedRevision: workspace.revision,
      });
      if (generation !== activationGenerationRef.current || !response.workspace) return;
      patch({ workspace: response.workspace });
    } catch (error) {
      if (generation === activationGenerationRef.current) patch({ error: errorText(error) });
    } finally {
      if (generation === activationGenerationRef.current) patch({ selectingProject: false });
    }
  }, [client, patch]);

  const clearProject = useCallback(async () => {
    const workspace = stateRef.current.workspace;
    if (
      !workspace ||
      workspace.kind !== 'draft' ||
      !workspace.cwd ||
      stateRef.current.selectingProject
    ) {
      return;
    }
    const generation = activationGenerationRef.current;
    patch({ selectingProject: true, error: '' });
    try {
      const response = await client.request({
        type: 'panerelay.workspace.clear-directory',
        expectedRevision: workspace.revision,
      });
      if (generation !== activationGenerationRef.current || !response.workspace) return;
      patch({ workspace: response.workspace });
    } catch (error) {
      if (generation === activationGenerationRef.current) patch({ error: errorText(error) });
    } finally {
      if (generation === activationGenerationRef.current) patch({ selectingProject: false });
    }
  }, [client, patch]);

  const togglePageComments = useCallback(async () => {
    if (stateRef.current.pageCommentsPending) return;
    const wasActive = stateRef.current.commentMode;
    patch({ pageCommentsPending: true, error: '' });
    try {
      if (!wasActive && stateRef.current.extensionStatus?.automationAvailable === false) {
        const authorization = originAuthorizationForUrl(
          stateRef.current.extensionStatus.activeTab?.url || '',
        );
        if (!authorization) {
          throw new Error(translate(stateRef.current.locale, 'unsupportedBrowserPage'));
        }
        if (!(await client.requestOrigins([authorization.permissionPattern]))) {
          throw new Error(translate(stateRef.current.locale, 'pageCommentAccessDenied'));
        }
      }
      await client.request({
        type: wasActive ? 'panerelay.page-comments.stop' : 'panerelay.page-comments.start',
        ...(!wasActive
          ? {
              locale: stateRef.current.locale,
              theme:
                stateRef.current.themeSetting === 'system'
                  ? client.prefersLightTheme()
                    ? 'light'
                    : 'dark'
                  : stateRef.current.themeSetting,
            }
          : {}),
      });
      patch({ commentMode: !wasActive });
    } catch (error) {
      patch({ error: errorText(error) });
    } finally {
      patch({ pageCommentsPending: false });
    }
  }, [client, patch]);

  const startContinuousPageComments = useCallback(async () => {
    patch({ pageCommentsPending: true, error: '' });
    try {
      if (stateRef.current.extensionStatus?.automationAvailable === false) {
        const authorization = originAuthorizationForUrl(
          stateRef.current.extensionStatus.activeTab?.url || '',
        );
        if (!authorization) {
          throw new Error(translate(stateRef.current.locale, 'unsupportedBrowserPage'));
        }
        if (!(await client.requestOrigins([authorization.permissionPattern]))) {
          throw new Error(translate(stateRef.current.locale, 'pageCommentAccessDenied'));
        }
      }
      await client.request({
        type: 'panerelay.page-comments.start',
        continuous: true,
        locale: stateRef.current.locale,
        theme:
          stateRef.current.themeSetting === 'system'
            ? client.prefersLightTheme()
              ? 'light'
              : 'dark'
            : stateRef.current.themeSetting,
      });
      patch({ commentMode: true });
    } catch (error) {
      patch({ error: errorText(error) });
    } finally {
      patch({ pageCommentsPending: false });
    }
  }, [client, patch]);

  const editPageComment = useCallback(
    async (commentId: string) => {
      try {
        await client.request({ type: 'panerelay.page-comments.edit', commentId });
      } catch (error) {
        patch({ error: errorText(error) });
      }
    },
    [client, patch],
  );

  const removePageComment = useCallback(
    async (commentId: string) => {
      try {
        await client.request({ type: 'panerelay.page-comments.remove', commentId });
        patch({
          pageComments: stateRef.current.pageComments.filter(comment => comment.id !== commentId),
        });
      } catch (error) {
        patch({ error: errorText(error) });
      }
    },
    [client, patch],
  );

  const addPastedImages = useCallback(
    async (files: File[]) => {
      const provider = stateRef.current.providers.find(
        item => item.id === stateRef.current.currentProviderId,
      );
      if (provider?.capabilities?.imageInput === false) {
        patch({ imageError: translate(stateRef.current.locale, 'providerImageUnsupported') });
        return;
      }

      const current = stateRef.current.pastedImages;
      let totalBytes = current.reduce((total, image) => total + image.size, 0);
      const accepted: File[] = [];
      let imageError = '';
      for (const file of files) {
        if (current.length + accepted.length >= CONVERSATION_MAX_IMAGES) {
          imageError = formatCopy(stateRef.current.locale, 'tooManyImages', {
            count: String(CONVERSATION_MAX_IMAGES),
          });
          break;
        }
        if (!SUPPORTED_IMAGE_MIME_TYPES.has(file.type)) {
          imageError = translate(stateRef.current.locale, 'unsupportedImage');
          continue;
        }
        if (file.size > CONVERSATION_MAX_IMAGE_BYTES) {
          imageError = formatCopy(stateRef.current.locale, 'imageTooLarge', {
            size: String(CONVERSATION_MAX_IMAGE_BYTES / 1024 / 1024),
          });
          continue;
        }
        if (totalBytes + file.size > CONVERSATION_MAX_TOTAL_IMAGE_BYTES) {
          imageError = formatCopy(stateRef.current.locale, 'imagesTooLarge', {
            size: String(CONVERSATION_MAX_TOTAL_IMAGE_BYTES / 1024 / 1024),
          });
          continue;
        }
        accepted.push(file);
        totalBytes += file.size;
      }
      patch({ imageError });
      if (accepted.length === 0) return;

      const generation = pastedImageGenerationRef.current;
      try {
        const images = await Promise.all(
          accepted.map(async (file, index): Promise<PastedImage> => ({
            id: `pasted-image-${Date.now()}-${index}-${randomId()}`,
            data: await readImageData(file),
            mimeType: file.type,
            ...(file.name ? { name: file.name } : {}),
            size: file.size,
          })),
        );
        if (generation !== pastedImageGenerationRef.current) return;
        patch({ pastedImages: [...stateRef.current.pastedImages, ...images] });
      } catch {
        if (generation === pastedImageGenerationRef.current) {
          patch({ imageError: translate(stateRef.current.locale, 'imageReadFailed') });
        }
      }
    },
    [patch],
  );

  const removePastedImage = useCallback(
    (imageId: string) => {
      patch({
        pastedImages: stateRef.current.pastedImages.filter(image => image.id !== imageId),
        imageError: '',
      });
    },
    [patch],
  );

  const useSuggestion = useCallback(
    (kind: 'summarize' | 'inspect' | 'find') => {
      const key =
        kind === 'summarize'
          ? 'suggestSummarizePrompt'
          : kind === 'inspect'
            ? 'suggestInspectPrompt'
            : 'suggestFindPrompt';
      patch({ composerText: translate(stateRef.current.locale, key) });
    },
    [patch],
  );

  const sendMessage = useCallback(
    async (value?: string) => {
      const message = (value ?? stateRef.current.composerText).trim();
      const pageComments = [...stateRef.current.pageComments];
      const pastedImages = [...stateRef.current.pastedImages];
      if (
        (!message && pageComments.length === 0 && pastedImages.length === 0) ||
        stateRef.current.submitting
      ) {
        return;
      }
      const workspace = stateRef.current.workspace;
      if (!workspace) return;
      const generation = activationGenerationRef.current;
      const conversation = stateRef.current.currentConversation;
      const providerMessage = appendPageCommentsContext(
        message,
        pageComments,
        selectedAgentName(stateRef.current),
        translate(stateRef.current.locale, 'pageCommentsDefaultRequest'),
      );
      const displayMessage = [
        pageCommentsDisplayMessage(message, pageComments),
        ...(pastedImages.length > 0
          ? [
              formatCopy(stateRef.current.locale, 'attachedImages', {
                count: String(pastedImages.length),
              }),
            ]
          : []),
      ]
        .filter(Boolean)
        .join('\n');
      const optimisticMessageId = randomId();
      patch({
        submitting: true,
        commentMode: false,
        turnFeedback: conversation ? 'working' : 'starting',
        activeReasoning: null,
        error: '',
      });
      if (pageComments.length > 0) {
        void client.request({ type: 'panerelay.page-comments.stop' }).catch(() => undefined);
      }
      patch({
        composerText: '',
        timeline: [
          ...stateRef.current.timeline,
          {
            type: 'message',
            message: {
              id: optimisticMessageId,
              role: 'user',
              text: displayMessage,
              createdAt: new Date().toISOString(),
            },
          },
        ],
      });
      try {
        const response = await client.request({
          type: 'panerelay.conversation.send',
          providerId: conversationProviderId(conversation, stateRef.current.currentProviderId),
          ...(conversation ? { conversationId: conversation.id } : {}),
          expectedRevision: workspace.revision,
          text: providerMessage,
          ...(pastedImages.length
            ? {
                images: pastedImages.map(({ id: _id, size: _size, ...image }) => image),
              }
            : {}),
        });
        if (generation !== activationGenerationRef.current) return;
        const created = response.conversation?.conversation;
        patch({
          ...(response.workspace ? { workspace: response.workspace } : {}),
          ...(created ? { currentConversation: created } : {}),
          ...(response.turnId ? { runningTurnId: response.turnId } : {}),
          turnFeedback: stateRef.current.turnFeedback ? 'working' : null,
          ...(created && stateRef.current.historyLoadedProviderId === created.providerId
            ? {
                conversations: [
                  created,
                  ...stateRef.current.conversations.filter(item => item.id !== created.id),
                ],
              }
            : {}),
        });
        if (pageComments.length > 0) {
          patch({ pageComments: [] });
          void client.request({ type: 'panerelay.page-comments.clear' }).catch(() => undefined);
        }
        if (pastedImages.length > 0) {
          pastedImageGenerationRef.current += 1;
          patch({ pastedImages: [], imageError: '' });
        }
      } catch (error) {
        if (generation === activationGenerationRef.current) {
          let restoredWorkspace: ConversationWorkspaceSnapshot | undefined;
          try {
            restoredWorkspace = (
              await client.request({
                type: 'panerelay.workspace.get',
                providerId: stateRef.current.currentProviderId,
              })
            ).workspace;
          } catch {
            // Preserve the send error and the user's retry context.
          }
          if (generation !== activationGenerationRef.current) return;
          patch({
            ...(restoredWorkspace ? { workspace: restoredWorkspace } : {}),
            composerText: message,
            timeline: stateRef.current.timeline.filter(
              item => item.type !== 'message' || item.message.id !== optimisticMessageId,
            ),
            turnFeedback: null,
            activeReasoning: null,
            error: errorText(error),
          });
        }
      } finally {
        if (generation === activationGenerationRef.current) patch({ submitting: false });
      }
    },
    [client, patch],
  );

  const interrupt = useCallback(async () => {
    try {
      await interruptCurrent();
      patch({ turnFeedback: null, activeReasoning: null });
    } catch (error) {
      patch({ error: errorText(error) });
    }
  }, [interruptCurrent, patch]);

  const respondToApproval = useCallback(
    async (approval: ConversationApproval, decision: ConversationApprovalDecision) => {
      try {
        await client.request({
          type: 'panerelay.conversation.respond',
          providerId: conversationProviderId(
            stateRef.current.currentConversation,
            stateRef.current.currentProviderId,
          ),
          conversationId: approval.conversationId,
          approvalId: approval.id,
          decision,
        });
        patch({
          timeline: stateRef.current.timeline.filter(
            item => item.type !== 'approval' || item.approval.id !== approval.id,
          ),
          turnFeedback: 'working',
          activeReasoning: null,
        });
      } catch (error) {
        patch({ error: errorText(error) });
      }
    },
    [client, patch],
  );

  const automaticallyApprove = useCallback(
    async (approval: ConversationApproval) => {
      const decision = automaticApprovalDecision(approval);
      if (!decision || autoApprovingApprovalIdsRef.current.has(approval.id)) return;
      autoApprovingApprovalIdsRef.current.add(approval.id);
      try {
        await respondToApproval(approval, decision);
      } finally {
        autoApprovingApprovalIdsRef.current.delete(approval.id);
      }
    },
    [respondToApproval],
  );

  const setAutoApprove = useCallback(
    async (autoApprove: boolean) => {
      patch({ autoApprove });
      await client.setStored({ [AUTO_APPROVE_KEY]: autoApprove });
      if (!autoApprove) return;
      for (const item of stateRef.current.timeline) {
        if (item.type === 'approval') void automaticallyApprove(item.approval);
      }
    },
    [automaticallyApprove, client, patch],
  );

  const setLocale = useCallback(
    async (locale: Locale) => {
      patch({ locale });
      await client.setStored({ [LOCALE_KEY]: locale });
    },
    [client, patch],
  );

  const setTheme = useCallback(
    async (themeSetting: ThemeSetting) => {
      patch({ themeSetting });
      await client.setStored({ [THEME_KEY]: themeSetting });
    },
    [client, patch],
  );

  const setSettingsOpen = useCallback((settingsOpen: boolean) => patch({ settingsOpen }), [patch]);
  const dismissError = useCallback(() => patch({ error: '' }), [patch]);

  useLayoutEffect(() => {
    document.documentElement.lang = state.locale;
    document.documentElement.dataset.theme =
      state.themeSetting === 'system'
        ? client.prefersLightTheme()
          ? 'light'
          : 'dark'
        : state.themeSetting;
  }, [client, state.locale, state.themeSetting]);

  useEffect(
    () =>
      client.subscribeColorScheme(() => {
        if (stateRef.current.themeSetting === 'system') {
          document.documentElement.dataset.theme = client.prefersLightTheme() ? 'light' : 'dark';
        }
      }),
    [client],
  );

  useEffect(
    () =>
      client.subscribe(message => {
        if (message.type === 'panerelay.page-comment.changed' && message.comment) {
          const existingIndex = stateRef.current.pageComments.findIndex(
            comment => comment.id === message.comment?.id,
          );
          patch({
            pageComments:
              existingIndex < 0
                ? [...stateRef.current.pageComments, message.comment]
                : stateRef.current.pageComments.map(comment =>
                    comment.id === message.comment?.id ? message.comment : comment,
                  ),
          });
          return;
        }
        if (message.type === 'panerelay.page-comment.removed' && message.commentId) {
          patch({
            pageComments: stateRef.current.pageComments.filter(
              comment => comment.id !== message.commentId,
            ),
          });
          return;
        }
        if (message.type === 'panerelay.page-comment.mode') {
          patch({ commentMode: message.active === true });
          return;
        }
        if (message.type === 'panerelay.page-comment.reset') {
          patch({ pageComments: [], commentMode: false, pageCommentsPending: false });
          return;
        }
        if (message.type === 'panerelay.status.changed' && message.status) {
          const wasConnected = stateRef.current.extensionStatus?.bridgeConnected ?? false;
          patch({
            extensionStatus: message.status,
            error:
              message.status.nativeHostState === 'missing'
                ? ''
                : message.status.error
                  ? message.status.error
                  : message.status.bridgeConnected
                    ? ''
                    : stateRef.current.error,
          });
          if (!wasConnected && message.status.bridgeConnected) void initialize();
          return;
        }
        if (message.type === 'panerelay.workspace.changed') {
          if (message.workspace?.revision === stateRef.current.workspace?.revision) return;
          void restoreWorkspace(message.workspace);
          return;
        }
        if (message.type === 'panerelay.conversation.event' && message.event) {
          if (message.event.conversationId !== stateRef.current.currentConversation?.id) {
            for (const [key, cached] of conversationViewsRef.current) {
              if (cached.conversation.id !== message.event.conversationId) continue;
              const cachedState = sidepanelReducer(
                {
                  ...stateRef.current,
                  currentConversation: cached.conversation,
                  timeline: cached.timeline,
                  runningTurnId: cached.runningTurnId,
                  turnFeedback: cached.turnFeedback,
                  activeReasoning: cached.activeReasoning,
                },
                {
                  type: 'conversation-event',
                  event: message.event,
                  interruptedMessage: translate(stateRef.current.locale, 'interrupted'),
                  failedMessage: translate(stateRef.current.locale, 'failed'),
                },
              );
              conversationViewsRef.current.set(key, {
                conversation: cachedState.currentConversation ?? cached.conversation,
                timeline: cachedState.timeline,
                runningTurnId: cachedState.runningTurnId,
                turnFeedback: cachedState.turnFeedback,
                activeReasoning: cachedState.activeReasoning,
              });
            }
            return;
          }
          commit({
            type: 'conversation-event',
            event: message.event,
            interruptedMessage: translate(stateRef.current.locale, 'interrupted'),
            failedMessage: translate(stateRef.current.locale, 'failed'),
          });
          if (message.event.kind === 'approval.requested' && stateRef.current.autoApprove) {
            void automaticallyApprove(message.event.approval);
          }
        }
      }),
    [automaticallyApprove, client, commit, initialize, patch, restoreWorkspace],
  );

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return {
    state,
    initialize,
    setProvider,
    selectConversation,
    newConversation,
    setHistoryOpen,
    setHistoryQuery,
    refreshHistory,
    retryProviderPreparation,
    setAuthorization,
    retryNativeHost,
    setDefaultProvider,
    activateControlledTab,
    closeControlledTab,
    setComposerText,
    selectProject,
    clearProject,
    togglePageComments,
    startContinuousPageComments,
    editPageComment,
    removePageComment,
    addPastedImages,
    removePastedImage,
    setAutoApprove,
    useSuggestion,
    sendMessage,
    interrupt,
    respondToApproval,
    setLocale,
    setTheme,
    setSettingsOpen,
    dismissError,
  };
}

export function selectedAgentName(state: SidepanelState): string {
  return (
    state.providers.find(provider => provider.id === state.currentProviderId)?.name ||
    translate(state.locale, 'assistant')
  );
}

export function formatForState(
  state: SidepanelState,
  key: Parameters<typeof formatCopy>[1],
  values: Record<string, string | number>,
): string {
  return formatCopy(state.locale, key, values);
}
