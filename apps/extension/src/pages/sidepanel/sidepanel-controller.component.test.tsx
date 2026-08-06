import type {
  AgentProviderSummary,
  ConversationApproval,
  ConversationDetail,
  ConversationEvent,
} from '@panerelay/protocol';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ExtensionStatus, SidePanelRequest } from '../../shared/messages.js';
import type { ConversationWorkspaceSnapshot } from '../../shared/conversation-workspaces.js';
import {
  createConversationTimelineSnapshot,
  type ConversationTimelineReplay,
  type ConversationTimelineSnapshot,
} from '../../shared/conversation-timeline.js';
import { ACCENT_COLOR_KEY, accentPalette, DEFAULT_ACCENT_COLOR } from '../../shared/appearance.js';
import type { PageElementComment } from '../../shared/page-comments.js';
import {
  AUTO_APPROVE_KEY,
  createInitialSidepanelState,
  sidepanelReducer,
  useSidepanelController,
} from './sidepanel-controller.js';
import type { SidepanelClient, SidepanelRuntimeMessage } from './sidepanel-client.js';
import {
  createProviderBootstrap,
  providerCacheValue,
  PROVIDER_CACHE_KEY,
  supportedProviders,
} from './provider-selection.js';

const baseStatus: ExtensionStatus = {
  bridgeConnected: true,
  nativeHostState: 'connected',
  hostRelease: {
    state: 'ready',
    hostVersion: '0.7.0',
    targetVersion: '0.7.0',
    retryAvailable: false,
  },
  defaultProvider: { available: true, provider: null, isPanerelay: false },
  browserUseDefault: { available: true, mode: 'direct', isPanerelay: false },
  browserDefault: {
    currentBrowser: {
      browserId: 'edge-browser-id',
      browserName: 'Microsoft Edge',
      browserFamily: 'edge',
    },
    defaultBrowserId: null,
    hasMultipleBrowsers: true,
    isCurrentBrowser: false,
  },
  authorizationRequest: null,
  activeTab: { id: 3, title: 'Fixture', url: 'https://example.com/page' },
  authorizationMode: 'none',
  authorizedOriginPatterns: [],
  authorizedTab: null,
  controlledTab: null,
  controlledTabs: [],
  controlSession: null,
  automationActivities: [],
  automationHistoryGap: false,
};

const providers: AgentProviderSummary[] = [
  {
    id: 'codex',
    name: 'Codex',
    status: 'ready',
    description: 'Codex fixture',
    capabilities: { imageInput: true },
  },
  {
    id: 'qoder',
    name: 'Qoder',
    status: 'ready',
    description: 'Qoder fixture',
    capabilities: { imageInput: true },
  },
];

function conversation(providerId = 'codex'): ConversationDetail {
  return {
    conversation: {
      id: `${providerId}-conversation`,
      providerId,
      title: `${providerId} history`,
      preview: 'fixture',
      status: 'idle',
      createdAt: '2026-07-30T00:00:00.000Z',
      updatedAt: '2026-07-30T00:00:00.000Z',
    },
    messages: [
      {
        id: `${providerId}-message`,
        role: 'assistant',
        text: 'Existing answer',
        createdAt: '2026-07-30T00:00:00.000Z',
      },
    ],
  };
}

class FakeSidepanelClient implements SidepanelClient {
  readonly requests: SidePanelRequest[] = [];
  readonly originRequests: string[][] = [];
  readonly storedWrites: Record<string, unknown>[] = [];
  readonly listeners = new Set<(message: SidepanelRuntimeMessage) => void>();
  stored: Record<string, unknown> = { 'panerelay.locale': 'en' };
  status = baseStatus;
  workspace: ConversationWorkspaceSnapshot = {
    kind: 'draft',
    providerId: 'codex',
    revision: 'workspace-1',
  };
  nextWorkspace = 1;
  projectCancelled = false;
  projectError = '';
  installError = '';
  installPromise: Promise<void> | null = null;
  providerDiscoveryPromise: Promise<void> | null = null;
  providerCacheWriteError = '';
  providerResponse = providers;
  sendError = '';
  timelineReplay: ConversationTimelineReplay = { snapshot: null, events: [] };
  timelineLoadHandler:
    | ((
        message: Extract<SidePanelRequest, { type: 'panerelay.conversation-timeline.load' }>,
      ) => Promise<ConversationTimelineReplay>)
    | undefined;
  savedTimelineSnapshots: ConversationTimelineSnapshot[] = [];
  resumeHandler:
    | ((message: Extract<SidePanelRequest, { type: 'panerelay.conversation.resume' }>) => Promise<{
        success: true;
        conversation: ConversationDetail;
        workspace: ConversationWorkspaceSnapshot;
      }>)
    | undefined;

  async getStored(): Promise<Record<string, unknown>> {
    return this.stored;
  }

  async setStored(values: Record<string, unknown>): Promise<void> {
    if (this.providerCacheWriteError && PROVIDER_CACHE_KEY in values) {
      throw new Error(this.providerCacheWriteError);
    }
    this.storedWrites.push(values);
    Object.assign(this.stored, values);
  }

  async request(message: SidePanelRequest) {
    this.requests.push(message);
    switch (message.type) {
      case 'panerelay.status.get':
        return { success: true as const, status: this.status };
      case 'panerelay.agent.providers': {
        const pending = this.providerDiscoveryPromise;
        const response = this.providerResponse;
        if (pending) await pending;
        return { success: true as const, providers: response };
      }
      case 'panerelay.agent.prepare':
        return { success: true as const };
      case 'panerelay.workspace.get':
        return { success: true as const, workspace: this.workspace };
      case 'panerelay.workspace.reset':
        this.workspace = {
          kind: 'draft',
          providerId: message.providerId,
          revision: `workspace-${++this.nextWorkspace}`,
        };
        return { success: true as const, workspace: this.workspace };
      case 'panerelay.workspace.pick-directory':
        if (this.projectError) throw new Error(this.projectError);
        if (this.projectCancelled) return { success: true as const };
        this.workspace = {
          ...this.workspace,
          cwd: '/workspace/project',
          revision: `workspace-${++this.nextWorkspace}`,
        };
        return { success: true as const, workspace: this.workspace };
      case 'panerelay.workspace.clear-directory': {
        const { cwd: _cwd, ...workspace } = this.workspace;
        this.workspace = {
          ...workspace,
          revision: `workspace-${++this.nextWorkspace}`,
        } as ConversationWorkspaceSnapshot;
        return { success: true as const, workspace: this.workspace };
      }
      case 'panerelay.conversation.list': {
        const detail = conversation(message.providerId);
        return { success: true as const, conversations: [detail.conversation] };
      }
      case 'panerelay.conversation-timeline.load':
        return {
          success: true as const,
          timeline: this.timelineLoadHandler
            ? await this.timelineLoadHandler(message)
            : this.timelineReplay,
        };
      case 'panerelay.conversation-timeline.save':
        this.savedTimelineSnapshots.push(message.snapshot);
        return { success: true as const };
      case 'panerelay.conversation.resume': {
        if (this.resumeHandler) return this.resumeHandler(message);
        const loaded = conversation(message.providerId);
        this.workspace = {
          kind: 'conversation',
          providerId: message.providerId,
          conversationId: loaded.conversation.id,
          revision: `workspace-${++this.nextWorkspace}`,
        };
        return {
          success: true as const,
          conversation: loaded,
          workspace: this.workspace,
        };
      }
      case 'panerelay.authorization.set':
        this.status = {
          ...this.status,
          authorizationMode: message.mode,
          authorizedOriginPatterns: message.mode === 'none' ? [] : ['https://example.com/*'],
          authorizedTab: message.mode === 'single-tab' ? baseStatus.activeTab : null,
        };
        return { success: true as const, status: this.status };
      case 'panerelay.control.release':
        return { success: true as const, status: this.status };
      case 'panerelay.native.retry':
        return { success: true as const, status: baseStatus };
      case 'panerelay.integration.install':
        if (this.installPromise) await this.installPromise;
        if (this.installError) throw new Error(this.installError);
        return {
          success: true as const,
          status: {
            ...baseStatus,
            ...(message.integration === 'agent-browser'
              ? {
                  defaultProvider: {
                    available: true,
                    provider: 'panerelay',
                    isPanerelay: true,
                  },
                }
              : {
                  browserUseDefault: {
                    available: true,
                    mode: 'extension' as const,
                    isPanerelay: true,
                  },
                }),
          },
        };
      case 'panerelay.default-provider.set':
        return {
          success: true as const,
          status: {
            ...baseStatus,
            defaultProvider: {
              available: true,
              provider: message.enabled ? 'panerelay' : null,
              isPanerelay: message.enabled,
            },
          },
        };
      case 'panerelay.browser-use-default.set':
        return {
          success: true as const,
          status: {
            ...baseStatus,
            browserUseDefault: {
              available: true,
              mode: message.enabled ? 'extension' : 'direct',
              isPanerelay: message.enabled,
            },
          },
        };
      case 'panerelay.browser-default.set':
        return {
          success: true as const,
          status: {
            ...baseStatus,
            browserDefault: {
              ...baseStatus.browserDefault!,
              defaultBrowserId: message.enabled ? 'edge-browser-id' : null,
              isCurrentBrowser: message.enabled,
            },
          },
        };
      case 'panerelay.browser-default.refresh':
        return { success: true as const, status: baseStatus };
      case 'panerelay.browser-use-default.refresh':
        return { success: true as const, status: baseStatus };
      case 'panerelay.controlled-tab.activate':
      case 'panerelay.controlled-tab.close':
      case 'panerelay.page-comments.start':
      case 'panerelay.page-comments.appearance':
      case 'panerelay.page-comments.stop':
      case 'panerelay.page-comments.edit':
      case 'panerelay.page-comments.remove':
      case 'panerelay.page-comments.clear':
        return { success: true as const };
      case 'panerelay.conversation.send': {
        if (this.sendError) {
          if (!message.conversationId) {
            this.workspace = {
              ...this.workspace,
              revision: `workspace-${++this.nextWorkspace}`,
            };
          }
          throw new Error(this.sendError);
        }
        if (!message.conversationId) {
          const created = conversation(message.providerId);
          this.workspace = {
            kind: 'conversation',
            providerId: message.providerId,
            conversationId: created.conversation.id,
            revision: `workspace-${++this.nextWorkspace}`,
          };
          return {
            success: true as const,
            conversation: created,
            turnId: 'turn-1',
            workspace: this.workspace,
          };
        }
        return { success: true as const, turnId: 'turn-1', workspace: this.workspace };
      }
      case 'panerelay.conversation.interrupt':
      case 'panerelay.conversation.respond':
        return { success: true as const };
    }
  }

  async requestOrigins(origins: string[]): Promise<boolean> {
    this.originRequests.push(origins);
    return true;
  }

  subscribe(listener: (message: SidepanelRuntimeMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(message: SidepanelRuntimeMessage): void {
    for (const listener of this.listeners) listener(message);
  }

  prefersLightTheme(): boolean {
    return true;
  }

  subscribeColorScheme(): () => void {
    return () => undefined;
  }
}

async function readyController() {
  const client = new FakeSidepanelClient();
  const hook = renderHook(() => useSidepanelController(client));
  await waitFor(() => expect(hook.result.current.state.initializing).toBe(false));
  return { client, hook };
}

describe('Side Panel controller', () => {
  it('keeps assistant messages around intervening activity instead of merging them', () => {
    const conversationState = {
      ...createInitialSidepanelState('en'),
      currentConversation: conversation().conversation,
    };
    const reduceEvent = (
      state: ReturnType<typeof createInitialSidepanelState>,
      event: ConversationEvent,
    ) =>
      sidepanelReducer(state, {
        type: 'conversation-event',
        event,
        interruptedMessage: 'Interrupted',
        failedMessage: 'Failed',
      });

    const baseEvent = { conversationId: 'codex-conversation', turnId: 'turn-order' };
    let state = reduceEvent(conversationState, {
      kind: 'message.delta',
      ...baseEvent,
      messageId: 'commentary-1',
      delta: 'Working',
    });
    state = reduceEvent(state, {
      kind: 'activity.updated',
      ...baseEvent,
      activity: {
        id: 'tool-1',
        kind: 'command',
        title: 'agent-browser snapshot',
        status: 'completed',
      },
    });
    state = reduceEvent(state, {
      kind: 'message.delta',
      ...baseEvent,
      messageId: 'final-1',
      delta: 'Final',
    });
    state = reduceEvent(state, {
      kind: 'message.delta',
      ...baseEvent,
      messageId: 'final-1',
      delta: ' answer',
    });

    expect(
      state.timeline.map(item => (item.type === 'message' ? item.message.id : item.type)),
    ).toEqual(['commentary-1', 'activity', 'final-1']);
    expect(state.timeline[0]).toEqual(
      expect.objectContaining({
        type: 'message',
        streaming: false,
        message: expect.objectContaining({ id: 'commentary-1', text: 'Working' }),
      }),
    );
    expect(state.timeline[2]).toEqual(
      expect.objectContaining({
        type: 'message',
        streaming: true,
        message: expect.objectContaining({ id: 'final-1', text: 'Final answer' }),
      }),
    );
    expect(state.timeline.filter(item => item.type === 'message' && item.streaming)).toHaveLength(
      1,
    );
  });

  it('segments one assistant message around intervening activity and preserves completion order', () => {
    const conversationState = {
      ...createInitialSidepanelState('en'),
      currentConversation: conversation().conversation,
    };
    let sequence = 0;
    const reduceEvent = (
      state: ReturnType<typeof createInitialSidepanelState>,
      event: ConversationEvent,
    ) => {
      sequence += 1;
      return sidepanelReducer(state, {
        type: 'conversation-event',
        event,
        interruptedMessage: 'Interrupted',
        failedMessage: 'Failed',
        diagnosticReceivedAt: `2026-08-05T04:00:0${sequence}.000Z`,
      });
    };

    const baseEvent = { conversationId: 'codex-conversation', turnId: 'turn-shared' };
    let state = reduceEvent(conversationState, {
      kind: 'message.delta',
      ...baseEvent,
      messageId: 'assistant-shared',
      delta: 'Before tool. ',
      phase: 'final',
    });
    state = reduceEvent(state, {
      kind: 'activity.updated',
      ...baseEvent,
      activity: {
        id: 'tool-shared',
        kind: 'browser',
        title: 'agent-browser snapshot',
        status: 'completed',
      },
    });
    state = reduceEvent(state, {
      kind: 'message.delta',
      ...baseEvent,
      messageId: 'assistant-shared',
      delta: 'After tool.',
      phase: 'final',
    });

    expect(state.timeline.map(item => item.type)).toEqual(['message', 'activity', 'message']);
    expect(state.timeline[0]).toMatchObject({ type: 'message', streaming: false });
    expect(state.timeline[2]).toMatchObject({ type: 'message', streaming: true });
    expect(state.timeline.filter(item => item.type === 'message' && item.streaming)).toHaveLength(
      1,
    );

    state = reduceEvent(state, {
      kind: 'message.completed',
      ...baseEvent,
      message: {
        id: 'assistant-shared',
        role: 'assistant',
        text: 'Before tool. After tool.',
        phase: 'final',
        createdAt: '2026-08-05T04:00:04.000Z',
      },
    });

    expect(state.timeline.map(item => item.type)).toEqual(['message', 'activity', 'message']);
    expect(state.timeline[0]).toMatchObject({
      type: 'message',
      turnId: 'turn-shared',
      streaming: false,
      message: { id: 'assistant-shared', text: 'Before tool. ' },
    });
    expect(state.timeline[2]).toMatchObject({
      type: 'message',
      turnId: 'turn-shared',
      streaming: false,
      segmentId: expect.any(String),
      message: { id: 'assistant-shared', text: 'After tool.' },
    });
    expect(state.diagnostics.eventTrace).toEqual([
      expect.objectContaining({
        sequence: 1,
        kind: 'message.delta',
        messageId: 'assistant-shared',
        deltaLength: 13,
      }),
      expect.objectContaining({
        sequence: 2,
        kind: 'activity.updated',
        activityId: 'tool-shared',
      }),
      expect.objectContaining({
        sequence: 3,
        kind: 'message.delta',
        messageId: 'assistant-shared',
        deltaLength: 11,
      }),
      expect.objectContaining({
        sequence: 4,
        kind: 'message.completed',
        messageId: 'assistant-shared',
      }),
    ]);
  });

  it('uses the cached preferred provider before live discovery', () => {
    const bootstrap = createProviderBootstrap(
      'qoder',
      providerCacheValue([
        {
          id: 'qoder',
          name: 'Qoder',
          status: 'ready',
          description: 'Qoder fixture',
          model: 'qoder-model',
        },
      ]),
    );

    const state = createInitialSidepanelState('en', bootstrap);
    expect(state.currentProviderId).toBe('qoder');
    expect(state.providers[0]).toEqual(
      expect.objectContaining({ id: 'qoder', status: 'ready', model: 'qoder-model' }),
    );
    expect(state.initializing).toBe(true);
  });

  it('replaces cached provider presentation with live discovery and persists it', async () => {
    const client = new FakeSidepanelClient();
    client.stored['panerelay.agentProvider'] = 'qoder';
    client.stored[PROVIDER_CACHE_KEY] = providerCacheValue([
      {
        id: 'qoder',
        name: 'Qoder',
        status: 'ready',
        description: 'Cached Qoder',
      },
    ]);
    client.providerResponse = [providers[0]!, { ...providers[1]!, status: 'unavailable' }];
    const bootstrap = createProviderBootstrap(
      client.stored['panerelay.agentProvider'],
      client.stored[PROVIDER_CACHE_KEY],
    );

    const hook = renderHook(() => useSidepanelController(client, bootstrap));
    await waitFor(() => expect(hook.result.current.state.initializing).toBe(false));

    expect(hook.result.current.state.currentProviderId).toBe('codex');
    expect(client.stored[PROVIDER_CACHE_KEY]).toEqual(
      providerCacheValue(supportedProviders(client.providerResponse)),
    );
  });

  it('keeps provider cache write failures out of the user-facing error state', async () => {
    const client = new FakeSidepanelClient();
    client.providerCacheWriteError = 'storage unavailable';
    const hook = renderHook(() => useSidepanelController(client));

    await waitFor(() => expect(hook.result.current.state.initializing).toBe(false));

    expect(hook.result.current.state.error).toBe('');
    expect(hook.result.current.state.currentProviderId).toBe('codex');
  });

  it('keeps history lazy and explicitly resumes the selected provider conversation', async () => {
    const { client, hook } = await readyController();

    expect(hook.result.current.state.currentConversation).toBeNull();
    expect(client.requests.some(request => request.type === 'panerelay.conversation.list')).toBe(
      false,
    );
    expect(client.requests).toContainEqual({
      type: 'panerelay.agent.prepare',
      providerId: 'codex',
    });

    await act(() => hook.result.current.setHistoryOpen(true));
    expect(hook.result.current.state.currentConversation).toBeNull();
    expect(hook.result.current.state.conversations[0]?.id).toBe('codex-conversation');

    await act(() => hook.result.current.selectConversation('codex-conversation'));
    expect(hook.result.current.state.currentConversation?.id).toBe('codex-conversation');
    expect(client.requests).toContainEqual({
      type: 'panerelay.conversation.resume',
      providerId: 'codex',
      conversationId: 'codex-conversation',
      expectedRevision: 'workspace-1',
    });
    expect(
      client.requests.filter(request => request.type === 'panerelay.conversation.resume'),
    ).toHaveLength(1);
    expect(client.requests).toContainEqual({
      type: 'panerelay.conversation-timeline.load',
      providerId: 'codex',
      conversationId: 'codex-conversation',
    });
  });

  it('restores a retained timeline when explicitly selecting cached history', async () => {
    const { client, hook } = await readyController();
    const retained = conversation('codex');
    const snapshot = createConversationTimelineSnapshot({
      providerId: 'codex',
      conversation: retained.conversation,
      timeline: [
        {
          type: 'message',
          message: {
            id: 'cached-user',
            role: 'user',
            text: 'Cached question',
            createdAt: '2026-08-05T06:00:00.000Z',
          },
        },
        { type: 'reasoning', id: 'cached-reasoning', text: 'Cached reasoning' },
      ],
      runningTurnId: null,
      throughSequence: 0,
    });
    expect(snapshot).not.toBeNull();
    client.timelineReplay = { snapshot: snapshot!, events: [] };

    await act(() => hook.result.current.setHistoryOpen(true));
    await act(() => hook.result.current.selectConversation('codex-conversation'));

    expect(
      hook.result.current.state.timeline.map(item =>
        item.type === 'message' ? `message:${item.message.id}` : item.type,
      ),
    ).toEqual(['message:cached-user', 'reasoning']);
    expect(hook.result.current.state.diagnostics.load.source).toBe('session-snapshot');
    expect(
      client.requests.filter(request => request.type === 'panerelay.conversation.resume'),
    ).toHaveLength(1);
  });

  it('keeps the current workspace when explicit history resume fails', async () => {
    const { client, hook } = await readyController();
    const previousWorkspace = hook.result.current.state.workspace;
    client.resumeHandler = async () => {
      throw new Error('Cached Qoder conversation is no longer resumable');
    };

    await act(() => hook.result.current.setHistoryOpen(true));
    await act(() => hook.result.current.selectConversation('codex-conversation'));

    expect(hook.result.current.state.workspace).toEqual(previousWorkspace);
    expect(hook.result.current.state.currentConversation).toBeNull();
    expect(hook.result.current.state.historyOpen).toBe(true);
    expect(hook.result.current.state.historyError).toBe(
      'Cached Qoder conversation is no longer resumable',
    );
  });

  it('keeps authorization, activity, approval, interruption, and settings explicit', async () => {
    const { client, hook } = await readyController();
    await act(() => hook.result.current.setHistoryOpen(true));
    await act(() => hook.result.current.selectConversation('codex-conversation'));

    await act(() => hook.result.current.setAuthorization('single-tab'));
    expect(client.originRequests).toEqual([['https://example.com/*']]);
    expect(hook.result.current.state.extensionStatus?.authorizationMode).toBe('single-tab');

    await act(() => hook.result.current.releaseControl());
    expect(client.requests).toContainEqual({ type: 'panerelay.control.release' });
    expect(hook.result.current.state.extensionStatus?.authorizationMode).toBe('single-tab');

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'activity.updated',
          conversationId: 'codex-conversation',
          turnId: 'turn-1',
          activity: {
            id: 'activity-1',
            kind: 'browser',
            title: 'Read page',
            status: 'completed',
          },
        },
      });
    });
    expect(hook.result.current.state.timeline).toContainEqual(
      expect.objectContaining({
        type: 'activity',
        activity: expect.objectContaining({ id: 'activity-1' }),
        turnId: 'turn-1',
      }),
    );

    const approval: ConversationApproval = {
      id: 'approval-1',
      conversationId: 'codex-conversation',
      turnId: 'turn-1',
      kind: 'command',
      title: 'Run command',
      decisions: ['accept', 'decline'],
    };
    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'approval.requested',
          conversationId: 'codex-conversation',
          turnId: 'turn-1',
          approval,
        },
      });
    });
    expect(hook.result.current.state.currentConversation?.status).toBe('waiting');
    await act(() => hook.result.current.respondToApproval(approval, 'accept'));
    expect(hook.result.current.state.timeline).not.toContainEqual(
      expect.objectContaining({ type: 'approval' }),
    );

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'turn.started',
          conversationId: 'codex-conversation',
          turnId: 'turn-2',
        },
      });
      hook.result.current.setSettingsOpen(true);
    });
    await act(() => hook.result.current.interrupt());
    expect(hook.result.current.state.settingsOpen).toBe(true);
    expect(client.requests).toContainEqual({
      type: 'panerelay.conversation.interrupt',
      providerId: 'codex',
      conversationId: 'codex-conversation',
      turnId: 'turn-2',
    });
  });

  it('surfaces and clears only global status errors', async () => {
    const { client, hook } = await readyController();

    act(() => {
      client.emit({
        type: 'panerelay.status.changed',
        status: { ...baseStatus, error: 'Native Host disconnected' },
      });
    });
    expect(hook.result.current.state.error).toBe('Native Host disconnected');

    act(() => {
      client.emit({
        type: 'panerelay.status.changed',
        status: baseStatus,
      });
    });
    expect(hook.result.current.state.error).toBe('');
    expect(client.listeners.size).toBe(1);

    act(() => {
      client.emit({
        type: 'panerelay.status.changed',
        status: {
          ...baseStatus,
          bridgeConnected: false,
          nativeHostState: 'missing',
          defaultProvider: null,
          error: 'Specified native messaging host not found.',
        },
      });
    });
    expect(hook.result.current.state.error).toBe('');

    hook.unmount();
    expect(client.listeners.size).toBe(0);
  });

  it('routes default, Native Host, and controlled-tab settings actions', async () => {
    const { client, hook } = await readyController();
    client.requests.length = 0;

    await act(() => hook.result.current.setDefaultProvider(true));
    await act(() => hook.result.current.setBrowserUseDefault(true));
    await act(() => hook.result.current.setBrowserDefault(true));
    await act(() => hook.result.current.activateControlledTab(9));
    await act(() => hook.result.current.closeControlledTab(9));
    await act(() => hook.result.current.retryNativeHost());

    expect(client.requests).toEqual([
      { type: 'panerelay.default-provider.set', enabled: true },
      { type: 'panerelay.browser-use-default.set', enabled: true },
      { type: 'panerelay.browser-default.set', enabled: true },
      { type: 'panerelay.controlled-tab.activate', tabId: 9 },
      { type: 'panerelay.controlled-tab.close', tabId: 9 },
      { type: 'panerelay.native.retry' },
    ]);
    expect(hook.result.current.state.defaultProviderPending).toBe(false);
    expect(hook.result.current.state.browserUseDefaultPending).toBe(false);
    expect(hook.result.current.state.browserDefaultPending).toBe(false);
    expect(hook.result.current.state.controlledTabPendingId).toBeNull();
    expect(hook.result.current.state.nativeRetryPending).toBe(false);
  });

  it('deduplicates manual provider rediscovery without touching workspace or authorization', async () => {
    const { client, hook } = await readyController();
    let releaseDiscovery: (() => void) | undefined;
    client.providerDiscoveryPromise = new Promise<void>(resolve => {
      releaseDiscovery = resolve;
    });
    client.providerResponse = [
      ...providers,
      {
        id: 'opencode',
        name: 'OpenCode',
        status: 'ready',
        description: 'OpenCode fixture',
      },
    ];
    client.requests.length = 0;

    let first: Promise<void> | undefined;
    await act(async () => {
      first = hook.result.current.retryProviderDiscovery();
      await Promise.resolve();
    });
    await act(() => hook.result.current.retryProviderDiscovery());

    expect(client.requests).toEqual([{ type: 'panerelay.agent.providers' }]);
    expect(hook.result.current.state.providerDiscoveryPending).toBe(true);

    releaseDiscovery?.();
    await act(() => first);

    expect(hook.result.current.state.providerDiscoveryPending).toBe(false);
    expect(
      hook.result.current.state.providers.find(provider => provider.id === 'opencode')?.status,
    ).toBe('ready');
    expect(hook.result.current.state.workspace).toEqual({
      kind: 'draft',
      providerId: 'codex',
      revision: 'workspace-1',
    });
    expect(hook.result.current.state.extensionStatus?.authorizationMode).toBe('none');
  });

  it('ignores a stale provider rediscovery response after switching providers', async () => {
    const { client, hook } = await readyController();
    let releaseDiscovery: (() => void) | undefined;
    client.providerResponse = providers.map(provider => ({
      ...provider,
      description: `${provider.name} stale`,
    }));
    client.providerDiscoveryPromise = new Promise<void>(resolve => {
      releaseDiscovery = resolve;
    });

    let discovery: Promise<void> | undefined;
    await act(async () => {
      discovery = hook.result.current.retryProviderDiscovery();
      await Promise.resolve();
    });

    client.providerDiscoveryPromise = null;
    client.providerResponse = providers.map(provider => ({
      ...provider,
      description: `${provider.name} refreshed`,
    }));
    await act(() => hook.result.current.setProvider('qoder'));
    await waitFor(() =>
      expect(hook.result.current.state.providerPreparations.qoder?.status).toBe('ready'),
    );

    releaseDiscovery?.();
    await act(() => discovery);

    expect(hook.result.current.state.providerDiscoveryPending).toBe(false);
    expect(hook.result.current.state.currentProviderId).toBe('qoder');
    expect(hook.result.current.state.providerPreparations.qoder?.status).toBe('ready');
    expect(
      hook.result.current.state.providers.find(provider => provider.id === 'qoder')?.description,
    ).toBe('Qoder refreshed');
  });

  it('routes fixed integration installs and localizes installation failures', async () => {
    const { client, hook } = await readyController();
    client.requests.length = 0;

    await act(() => hook.result.current.installIntegration('agent-browser'));
    await act(() => hook.result.current.installIntegration('browser-use'));
    expect(client.requests).toEqual([
      { type: 'panerelay.integration.install', integration: 'agent-browser' },
      { type: 'panerelay.integration.install', integration: 'browser-use' },
    ]);

    client.installError = 'private package runner output';
    await act(() => hook.result.current.installIntegration('browser-use'));
    expect(hook.result.current.state.error).toBe(
      'Could not install browser-use. Run: npx --yes @panerelay/setup --browser-use',
    );
    expect(hook.result.current.state.error).not.toContain('private package runner output');
  });

  it('rejects duplicate integration clicks while installation is pending', async () => {
    const { client, hook } = await readyController();
    client.requests.length = 0;
    let release: (() => void) | undefined;
    client.installPromise = new Promise<void>(resolve => {
      release = resolve;
    });
    let first: Promise<void> | undefined;
    await act(async () => {
      first = hook.result.current.installIntegration('agent-browser');
      await Promise.resolve();
    });
    await act(() => hook.result.current.installIntegration('agent-browser'));

    expect(
      client.requests.filter(request => request.type === 'panerelay.integration.install'),
    ).toHaveLength(1);
    expect(hook.result.current.state.defaultProviderPending).toBe(true);
    release?.();
    await act(() => first);
    expect(hook.result.current.state.defaultProviderPending).toBe(false);
  });

  it('switches providers through a new draft without listing or resuming history', async () => {
    const { client, hook } = await readyController();
    client.requests.length = 0;

    await act(() => hook.result.current.setProvider('qoder'));

    expect(hook.result.current.state.currentProviderId).toBe('qoder');
    expect(hook.result.current.state.currentConversation).toBeNull();
    expect(client.storedWrites).toContainEqual({ 'panerelay.agentProvider': 'qoder' });
    expect(client.requests).toContainEqual({
      type: 'panerelay.workspace.reset',
      providerId: 'qoder',
      expectedRevision: 'workspace-1',
    });
    expect(client.requests).toContainEqual({
      type: 'panerelay.agent.prepare',
      providerId: 'qoder',
    });
    expect(
      client.requests.some(
        request =>
          request.type === 'panerelay.conversation.list' ||
          request.type === 'panerelay.conversation.resume',
      ),
    ).toBe(false);
  });

  it('selects and clears a project only while the workspace is a draft', async () => {
    const { client, hook } = await readyController();
    client.requests.length = 0;

    await act(() => hook.result.current.selectProject());
    expect(hook.result.current.state.workspace?.cwd).toBe('/workspace/project');
    expect(client.requests).toContainEqual({
      type: 'panerelay.workspace.pick-directory',
      expectedRevision: 'workspace-1',
    });

    await act(() => hook.result.current.clearProject());
    expect(hook.result.current.state.workspace?.cwd).toBeUndefined();
    expect(client.requests).toContainEqual({
      type: 'panerelay.workspace.clear-directory',
      expectedRevision: 'workspace-2',
    });

    client.projectCancelled = true;
    await act(() => hook.result.current.selectProject());
    expect(hook.result.current.state.workspace?.cwd).toBeUndefined();
    expect(hook.result.current.state.selectingProject).toBe(false);

    client.projectCancelled = false;
    client.projectError = 'Project picker failed';
    await act(() => hook.result.current.selectProject());
    expect(hook.result.current.state.error).toBe('Project picker failed');
    expect(hook.result.current.state.selectingProject).toBe(false);

    await act(() => hook.result.current.setHistoryOpen(true));
    await act(() => hook.result.current.selectConversation('codex-conversation'));
    client.requests.length = 0;
    await act(() => hook.result.current.selectProject());
    expect(client.requests).toEqual([]);
  });

  it('collects page comments, sends them as untrusted context, and preserves them on failure', async () => {
    const { client, hook } = await readyController();
    const comment: PageElementComment = {
      id: 'comment-1',
      comment: 'Make this button clearer',
      page: { url: 'https://example.com/page', title: 'Fixture' },
      element: {
        tagName: 'button',
        selector: 'main > button.primary',
        text: 'Continue',
        rect: { left: 10, top: 20, width: 100, height: 30 },
      },
    };

    await act(() => hook.result.current.togglePageComments());
    expect(hook.result.current.state.commentMode).toBe(true);
    await act(() => hook.result.current.startContinuousPageComments());
    expect(client.requests).toContainEqual({
      type: 'panerelay.page-comments.start',
      continuous: true,
      locale: 'en',
      theme: 'light',
      accent: accentPalette(DEFAULT_ACCENT_COLOR, 'light'),
    });

    client.requests.length = 0;
    await act(() => hook.result.current.setAccentColor('#336699'));
    expect(hook.result.current.state.themeSetting).toBe('system');
    expect(client.storedWrites).toContainEqual({ [ACCENT_COLOR_KEY]: '#336699' });
    expect(client.requests).toContainEqual({
      type: 'panerelay.page-comments.appearance',
      theme: 'light',
      accent: accentPalette('#336699', 'light'),
    });
    act(() => {
      client.emit({
        type: 'panerelay.page-comment.changed',
        source: 'panerelay-page-comments',
        comment,
      });
    });
    expect(hook.result.current.state.pageComments).toEqual([comment]);

    act(() => {
      client.emit({
        type: 'panerelay.page-comment.mode',
        source: 'panerelay-page-comments',
        active: false,
      });
    });
    client.requests.length = 0;
    await act(() => hook.result.current.setAccentColor('#884466'));
    expect(client.requests).toContainEqual({
      type: 'panerelay.page-comments.appearance',
      theme: 'light',
      accent: accentPalette('#884466', 'light'),
    });

    await act(() => hook.result.current.sendMessage());
    const sent = client.requests.find(request => request.type === 'panerelay.conversation.send');
    expect(sent).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('Untrusted page evidence'),
      }),
    );
    if (sent?.type === 'panerelay.conversation.send') {
      expect(sent.text).toContain('Make this button clearer');
      expect(sent.text).not.toContain('tabId');
    }
    expect(hook.result.current.state.pageComments).toEqual([]);
    expect(client.requests).toContainEqual({ type: 'panerelay.page-comments.clear' });

    await act(() => hook.result.current.newConversation());
    client.sendError = 'Agent send failed';
    act(() => {
      client.emit({
        type: 'panerelay.page-comment.changed',
        source: 'panerelay-page-comments',
        comment,
      });
      hook.result.current.setComposerText('Please fix this');
    });
    await act(() => hook.result.current.sendMessage());
    expect(hook.result.current.state.composerText).toBe('Please fix this');
    expect(hook.result.current.state.pageComments).toEqual([comment]);
    expect(hook.result.current.state.error).toBe('Agent send failed');
    expect(hook.result.current.state.workspace?.revision).toBe(client.workspace.revision);
  });

  it('sends pasted images and preserves them with the draft after failure', async () => {
    const { client, hook } = await readyController();
    const file = new File([new Uint8Array([1, 2, 3])], 'screenshot.png', {
      type: 'image/png',
    });

    await act(() => hook.result.current.addPastedImages([file]));
    expect(hook.result.current.state.pastedImages).toEqual([
      expect.objectContaining({
        data: 'AQID',
        mimeType: 'image/png',
        name: 'screenshot.png',
        size: 3,
      }),
    ]);
    await act(() => hook.result.current.sendMessage());
    expect(client.requests).toContainEqual({
      type: 'panerelay.conversation.send',
      providerId: 'codex',
      expectedRevision: 'workspace-1',
      text: '',
      images: [{ data: 'AQID', mimeType: 'image/png', name: 'screenshot.png' }],
    });
    expect(hook.result.current.state.pastedImages).toEqual([]);

    await act(() => hook.result.current.newConversation());
    await act(() => hook.result.current.addPastedImages([file]));
    client.sendError = 'Agent send failed';
    await act(() => hook.result.current.sendMessage());
    expect(hook.result.current.state.pastedImages).toHaveLength(1);
    expect(hook.result.current.state.error).toBe('Agent send failed');
  });

  it('persists auto approval and only chooses a one-shot accept for the current conversation', async () => {
    const { client, hook } = await readyController();
    await act(() => hook.result.current.setHistoryOpen(true));
    await act(() => hook.result.current.selectConversation('codex-conversation'));
    client.requests.length = 0;

    const approval: ConversationApproval = {
      id: 'approval-auto',
      conversationId: 'codex-conversation',
      turnId: 'turn-auto',
      kind: 'tool',
      title: 'Run tool',
      decisions: ['accept', 'acceptForSession', 'decline'],
    };
    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'approval.requested',
          conversationId: 'codex-conversation',
          turnId: 'turn-auto',
          approval,
        },
      });
    });
    expect(client.requests.some(request => request.type === 'panerelay.conversation.respond')).toBe(
      false,
    );

    await act(() => hook.result.current.setAutoApprove(true));
    await waitFor(() =>
      expect(client.requests).toContainEqual({
        type: 'panerelay.conversation.respond',
        providerId: 'codex',
        conversationId: 'codex-conversation',
        approvalId: 'approval-auto',
        decision: 'accept',
      }),
    );
    expect(client.storedWrites).toContainEqual({ [AUTO_APPROVE_KEY]: true });

    client.requests.length = 0;
    const unsupported: ConversationApproval = {
      ...approval,
      id: 'approval-session-only',
      decisions: ['acceptForSession', 'decline'],
    };
    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'approval.requested',
          conversationId: 'codex-conversation',
          turnId: 'turn-auto',
          approval: unsupported,
        },
      });
    });
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(client.requests.some(request => request.type === 'panerelay.conversation.respond')).toBe(
      false,
    );
  });

  it('restores the saved auto-approval preference', async () => {
    const client = new FakeSidepanelClient();
    client.stored[AUTO_APPROVE_KEY] = true;
    const hook = renderHook(() => useSidepanelController(client));
    await waitFor(() => expect(hook.result.current.state.initializing).toBe(false));
    expect(hook.result.current.state.autoApprove).toBe(true);
  });

  it('applies provider-resumed messages on a fresh mount without restoring browser authority', async () => {
    const client = new FakeSidepanelClient();
    client.workspace = {
      kind: 'conversation',
      providerId: 'qoder',
      conversationId: 'qoder-conversation',
      revision: 'qoder-bound-workspace',
    };
    const resumed = conversation('qoder');
    resumed.messages = [
      {
        id: 'qoder-user-retained',
        role: 'user',
        text: 'Retained question',
        createdAt: '2026-08-05T04:18:26.000Z',
      },
      {
        id: 'qoder-assistant-retained',
        role: 'assistant',
        text: 'Retained answer',
        phase: 'final',
        createdAt: '2026-08-05T04:18:30.000Z',
      },
    ];
    client.resumeHandler = async message => {
      expect(message).toEqual({
        type: 'panerelay.conversation.resume',
        providerId: 'qoder',
        conversationId: 'qoder-conversation',
        expectedRevision: 'qoder-bound-workspace',
      });
      return { success: true, conversation: resumed, workspace: client.workspace };
    };

    const hook = renderHook(() => useSidepanelController(client));
    await waitFor(() => expect(hook.result.current.state.initializing).toBe(false));

    expect(
      hook.result.current.state.timeline.map(item =>
        item.type === 'message' ? [item.message.role, item.message.text] : item.type,
      ),
    ).toEqual([
      ['user', 'Retained question'],
      ['assistant', 'Retained answer'],
    ]);
    expect(hook.result.current.state.diagnostics.load.source).toBe('provider-resume');
    expect(hook.result.current.state.extensionStatus?.authorizationMode).toBe('none');
    expect(
      client.requests.some(
        request =>
          request.type === 'panerelay.authorization.set' ||
          request.type === 'panerelay.control.release',
      ),
    ).toBe(false);
  });

  it('restores the semantic session timeline and replays background events before empty provider history', async () => {
    const client = new FakeSidepanelClient();
    const retained = conversation('qoder');
    client.workspace = {
      kind: 'conversation',
      providerId: 'qoder',
      conversationId: retained.conversation.id,
      revision: 'qoder-session-workspace',
    };
    const snapshot = createConversationTimelineSnapshot({
      providerId: 'qoder',
      conversation: { ...retained.conversation, status: 'running' },
      timeline: [
        {
          type: 'message',
          message: {
            id: 'qoder-user-snapshot',
            role: 'user',
            text: 'Inspect the current page',
            createdAt: '2026-08-05T05:00:00.000Z',
          },
        },
        { type: 'reasoning', id: 'reasoning-1', text: 'I will inspect it', turnId: 'turn-1' },
        {
          type: 'activity',
          turnId: 'turn-1',
          activity: {
            id: 'tool-1',
            kind: 'tool',
            title: 'Read current page',
            status: 'completed',
          },
        },
        { type: 'error', id: 'warning-1', message: 'A bounded warning', turnId: 'turn-1' },
      ],
      runningTurnId: 'turn-1',
      throughSequence: 4,
    });
    expect(snapshot).not.toBeNull();
    client.timelineReplay = {
      snapshot: snapshot!,
      events: [
        {
          sequence: 5,
          event: {
            kind: 'message.completed',
            conversationId: retained.conversation.id,
            turnId: 'turn-1',
            message: {
              id: 'qoder-assistant-replayed',
              role: 'assistant',
              text: 'Output produced while the panel was closed',
              phase: 'final',
              createdAt: '2026-08-05T05:00:05.000Z',
            },
          },
        },
      ],
    };
    client.resumeHandler = async () => ({
      success: true,
      conversation: { conversation: { ...retained.conversation, status: 'idle' }, messages: [] },
      workspace: client.workspace,
    });

    const hook = renderHook(() => useSidepanelController(client));
    await waitFor(() => expect(hook.result.current.state.initializing).toBe(false));

    expect(
      hook.result.current.state.timeline.map(item =>
        item.type === 'message' ? `message:${item.message.id}` : item.type,
      ),
    ).toEqual([
      'message:qoder-user-snapshot',
      'reasoning',
      'activity',
      'error',
      'message:qoder-assistant-replayed',
    ]);
    expect(hook.result.current.state.diagnostics.load.source).toBe('session-snapshot');
    expect(hook.result.current.state.diagnostics.eventTrace).toHaveLength(1);
    await waitFor(() =>
      expect(client.savedTimelineSnapshots.some(item => item.throughSequence === 5)).toBe(true),
    );
    expect(
      client.savedTimelineSnapshots.some(item =>
        item.timeline.some(timelineItem => timelineItem.type === 'approval'),
      ),
    ).toBe(false);
    expect(hook.result.current.state.extensionStatus?.authorizationMode).toBe('none');
  });

  it('keeps retained messages once when provider history changes ids and order', async () => {
    const client = new FakeSidepanelClient();
    const retained = conversation('qoder');
    client.workspace = {
      kind: 'conversation',
      providerId: 'qoder',
      conversationId: retained.conversation.id,
      revision: 'qoder-merge-workspace',
    };
    const snapshot = createConversationTimelineSnapshot({
      providerId: 'qoder',
      conversation: retained.conversation,
      timeline: [
        {
          type: 'message',
          message: {
            id: 'local-user-message',
            role: 'user',
            text: 'Summarize the current page.',
            createdAt: '2026-08-05T05:10:00.000Z',
          },
        },
        { type: 'reasoning', id: 'retained-reasoning', text: 'Retained thought' },
        {
          type: 'activity',
          activity: { id: 'retained-tool', kind: 'tool', title: 'Tool', status: 'completed' },
        },
        {
          type: 'message',
          message: {
            id: 'live-assistant-message',
            role: 'assistant',
            text: 'Retained final answer',
            createdAt: '2026-08-05T05:10:02.000Z',
          },
        },
      ],
      runningTurnId: null,
      throughSequence: 2,
    });
    expect(snapshot).not.toBeNull();
    client.timelineReplay = { snapshot: snapshot!, events: [] };
    client.resumeHandler = async () => ({
      success: true,
      conversation: {
        conversation: retained.conversation,
        messages: [
          {
            id: 'provider-assistant-message',
            role: 'assistant',
            text: 'Provider final answer',
            createdAt: '2026-08-05T05:10:02.500Z',
          },
          {
            id: 'provider-user-message',
            role: 'user',
            text: 'Summarize the current page.',
            createdAt: '2026-08-05T05:10:00.500Z',
          },
        ],
      },
      workspace: client.workspace,
    });

    const hook = renderHook(() => useSidepanelController(client));
    await waitFor(() => expect(hook.result.current.state.initializing).toBe(false));
    expect(
      hook.result.current.state.timeline.map(item =>
        item.type === 'message' ? `message:${item.message.id}:${item.message.text}` : item.type,
      ),
    ).toEqual([
      'message:local-user-message:Summarize the current page.',
      'reasoning',
      'activity',
      'message:live-assistant-message:Retained final answer',
    ]);
    expect(hook.result.current.state.diagnostics.load.source).toBe('session-snapshot');
  });

  it('discards a delayed session snapshot after the active workspace changes', async () => {
    const client = new FakeSidepanelClient();
    const retained = conversation('codex');
    client.workspace = {
      kind: 'conversation',
      providerId: 'codex',
      conversationId: retained.conversation.id,
      revision: 'codex-delayed-snapshot',
    };
    let resolveTimeline!: (value: ConversationTimelineReplay) => void;
    client.timelineLoadHandler = () =>
      new Promise(resolve => {
        resolveTimeline = resolve;
      });
    const hook = renderHook(() => useSidepanelController(client));
    await waitFor(() => expect(resolveTimeline).toBeTypeOf('function'));

    const qoderDraft: ConversationWorkspaceSnapshot = {
      kind: 'draft',
      providerId: 'qoder',
      revision: 'qoder-newer-workspace',
    };
    act(() => {
      client.workspace = qoderDraft;
      client.emit({ type: 'panerelay.workspace.changed', workspace: qoderDraft });
    });
    const snapshot = createConversationTimelineSnapshot({
      providerId: 'codex',
      conversation: retained.conversation,
      timeline: [{ type: 'reasoning', id: 'late-reasoning', text: 'Too late' }],
      runningTurnId: null,
      throughSequence: 0,
    });
    expect(snapshot).not.toBeNull();
    resolveTimeline({ snapshot: snapshot!, events: [] });

    await waitFor(() => expect(hook.result.current.state.currentProviderId).toBe('qoder'));
    expect(hook.result.current.state.currentConversation).toBeNull();
    expect(hook.result.current.state.timeline).toEqual([]);
  });

  it('restores cached tab conversations and discards a delayed resume after activation changes', async () => {
    const { client, hook } = await readyController();
    await act(() => hook.result.current.setHistoryOpen(true));
    await act(() => hook.result.current.selectConversation('codex-conversation'));
    const codexWorkspace = client.workspace;
    const resumeCount = client.requests.filter(
      request => request.type === 'panerelay.conversation.resume',
    ).length;

    const qoderDraft: ConversationWorkspaceSnapshot = {
      kind: 'draft',
      providerId: 'qoder',
      revision: 'qoder-related-tab',
    };
    act(() => {
      client.workspace = qoderDraft;
      client.emit({ type: 'panerelay.workspace.changed', workspace: qoderDraft });
    });
    await waitFor(() => expect(hook.result.current.state.currentProviderId).toBe('qoder'));

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'message.delta',
          conversationId: 'codex-conversation',
          turnId: 'turn-background',
          messageId: 'background-message',
          delta: 'Background answer',
        },
      });
    });
    expect(hook.result.current.state.timeline).toHaveLength(0);

    act(() => {
      client.workspace = codexWorkspace;
      client.emit({ type: 'panerelay.workspace.changed', workspace: codexWorkspace });
    });
    await waitFor(() =>
      expect(hook.result.current.state.currentConversation?.id).toBe('codex-conversation'),
    );
    expect(hook.result.current.state.timeline).toContainEqual(
      expect.objectContaining({
        type: 'message',
        message: expect.objectContaining({ id: 'background-message', text: 'Background answer' }),
      }),
    );
    expect(
      client.requests.filter(request => request.type === 'panerelay.conversation.resume'),
    ).toHaveLength(resumeCount);

    let resolveResume!: (value: {
      success: true;
      conversation: ConversationDetail;
      workspace: ConversationWorkspaceSnapshot;
    }) => void;
    client.resumeHandler = () =>
      new Promise(resolve => {
        resolveResume = resolve;
      });
    await act(() => hook.result.current.setHistoryOpen(true));
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.selectConversation('codex-conversation');
    });
    await new Promise<void>(resolve => setImmediate(resolve));
    act(() => {
      client.workspace = qoderDraft;
      client.emit({ type: 'panerelay.workspace.changed', workspace: qoderDraft });
    });
    resolveResume({
      success: true,
      conversation: conversation(),
      workspace: {
        kind: 'conversation',
        providerId: 'codex',
        conversationId: 'codex-conversation',
        revision: 'late-resume',
      },
    });
    await act(() => pending);

    expect(hook.result.current.state.currentProviderId).toBe('qoder');
    expect(hook.result.current.state.currentConversation).toBeNull();
  });

  it('interrupts a running turn before resetting to a new draft', async () => {
    const { client, hook } = await readyController();
    await act(() => hook.result.current.setHistoryOpen(true));
    await act(() => hook.result.current.selectConversation('codex-conversation'));
    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'turn.started',
          conversationId: 'codex-conversation',
          turnId: 'turn-running',
        },
      });
    });
    client.requests.length = 0;

    await act(() => hook.result.current.newConversation());

    expect(client.requests.map(request => request.type)).toEqual([
      'panerelay.conversation.interrupt',
      'panerelay.workspace.reset',
    ]);
    expect(hook.result.current.state.currentConversation).toBeNull();
    expect(hook.result.current.state.workspace?.kind).toBe('draft');
  });

  it('reduces unrelated conversation events without stealing the active conversation', () => {
    const initial = {
      ...createInitialSidepanelState('en'),
      currentConversation: conversation().conversation,
      timeline: conversation().messages.map(message => ({ type: 'message' as const, message })),
    };
    const next = sidepanelReducer(initial, {
      type: 'conversation-event',
      event: {
        kind: 'message.delta',
        conversationId: 'another-conversation',
        turnId: 'turn-x',
        messageId: 'message-x',
        delta: 'ignore me',
      },
      interruptedMessage: 'Interrupted',
      failedMessage: 'Failed',
    });
    expect(next).toBe(initial);
  });
});
