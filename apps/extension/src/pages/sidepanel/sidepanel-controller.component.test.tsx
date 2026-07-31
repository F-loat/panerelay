import type {
  AgentProviderSummary,
  ConversationApproval,
  ConversationDetail,
} from '@panerelay/protocol';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ExtensionStatus, SidePanelRequest } from '../../shared/messages.js';
import type { ConversationWorkspaceSnapshot } from '../../shared/conversation-workspaces.js';
import type { PageElementComment } from '../../shared/page-comments.js';
import {
  AUTO_APPROVE_KEY,
  createInitialSidepanelState,
  sidepanelReducer,
  useSidepanelController,
} from './sidepanel-controller.js';
import type { SidepanelClient, SidepanelRuntimeMessage } from './sidepanel-client.js';

const baseStatus: ExtensionStatus = {
  bridgeConnected: true,
  nativeHostState: 'connected',
  defaultProvider: { provider: null, isPanerelay: false },
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
  workspace: ConversationWorkspaceSnapshot = {
    kind: 'draft',
    providerId: 'codex',
    revision: 'workspace-1',
  };
  nextWorkspace = 1;
  projectCancelled = false;
  projectError = '';
  sendError = '';
  status: ExtensionStatus = baseStatus;
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
    this.storedWrites.push(values);
    Object.assign(this.stored, values);
  }

  async request(message: SidePanelRequest) {
    this.requests.push(message);
    switch (message.type) {
      case 'panerelay.status.get':
        return { success: true as const, status: this.status };
      case 'panerelay.agent.providers':
        return { success: true as const, providers };
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
        return {
          success: true as const,
          status: {
            ...baseStatus,
            authorizationMode: message.mode,
            authorizedOriginPatterns: message.mode === 'none' ? [] : ['https://example.com/*'],
            authorizedTab: message.mode === 'single-tab' ? baseStatus.activeTab : null,
          },
        };
      case 'panerelay.native.retry':
        return { success: true as const, status: baseStatus };
      case 'panerelay.default-provider.set':
        return {
          success: true as const,
          status: {
            ...baseStatus,
            defaultProvider: {
              provider: message.enabled ? 'panerelay' : null,
              isPanerelay: message.enabled,
            },
          },
        };
      case 'panerelay.controlled-tab.activate':
      case 'panerelay.controlled-tab.close':
      case 'panerelay.page-comments.start':
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

async function readyController(status: ExtensionStatus = baseStatus) {
  const client = new FakeSidepanelClient();
  client.status = status;
  const hook = renderHook(() => useSidepanelController(client));
  await waitFor(() => expect(hook.result.current.state.initializing).toBe(false));
  return { client, hook };
}

describe('Side Panel controller', () => {
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
  });

  it('keeps authorization, activity, approval, interruption, and settings explicit', async () => {
    const { client, hook } = await readyController();
    await act(() => hook.result.current.setHistoryOpen(true));
    await act(() => hook.result.current.selectConversation('codex-conversation'));

    await act(() => hook.result.current.setAuthorization('single-tab'));
    expect(client.originRequests).toEqual([['https://example.com/*']]);
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
    expect(hook.result.current.state.timeline).toContainEqual({
      type: 'activity',
      activity: expect.objectContaining({ id: 'activity-1' }),
    });

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
    await act(() => hook.result.current.activateControlledTab(9));
    await act(() => hook.result.current.closeControlledTab(9));
    await act(() => hook.result.current.retryNativeHost());

    expect(client.requests).toEqual([
      { type: 'panerelay.default-provider.set', enabled: true },
      { type: 'panerelay.controlled-tab.activate', tabId: 9 },
      { type: 'panerelay.controlled-tab.close', tabId: 9 },
      { type: 'panerelay.native.retry' },
    ]);
    expect(hook.result.current.state.defaultProviderPending).toBe(false);
    expect(hook.result.current.state.controlledTabPendingId).toBeNull();
    expect(hook.result.current.state.nativeRetryPending).toBe(false);
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
    });
    act(() => {
      client.emit({
        type: 'panerelay.page-comment.changed',
        source: 'panerelay-page-comments',
        comment,
      });
    });
    expect(hook.result.current.state.pageComments).toEqual([comment]);

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

  it('requests only the active origin before starting Firefox page comments', async () => {
    const { client, hook } = await readyController({
      ...baseStatus,
      automationAvailable: false,
      browserFamily: 'firefox',
    });
    client.requests.length = 0;

    await act(() => hook.result.current.togglePageComments());

    expect(client.originRequests).toEqual([['https://example.com/*']]);
    expect(client.requests).toContainEqual({
      type: 'panerelay.page-comments.start',
      locale: 'en',
      theme: 'light',
    });
    expect(client.requests.some(request => request.type === 'panerelay.authorization.set')).toBe(
      false,
    );
    expect(hook.result.current.state.commentMode).toBe(true);
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
