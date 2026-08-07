import type { AgentProviderSummary, ConversationDetail } from '@panerelay/protocol';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ExtensionStatus, SidePanelRequest } from '../../shared/messages.js';
import type { ConversationWorkspaceSnapshot } from '../../shared/conversation-workspaces.js';
import { SidepanelApp } from './app.js';
import type { SidepanelClient, SidepanelRuntimeMessage } from './sidepanel-client.js';

export const readyStatus: ExtensionStatus = {
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
    defaultBrowserId: 'chrome-browser-id',
    hasMultipleBrowsers: true,
    isCurrentBrowser: false,
  },
  authorizationRequest: null,
  fetchAuthorization: { allDomains: false, domains: [] },
  activeTab: { id: 8, title: 'Fixture page', url: 'https://example.com/page' },
  authorizationMode: 'none',
  authorizedOriginPatterns: [],
  authorizedTab: null,
  controlledTab: null,
  controlledTabs: [],
  controlSession: null,
  automationActivities: [],
  automationHistoryGap: false,
};

export const readyProviders: AgentProviderSummary[] = [
  {
    id: 'codex',
    name: 'Codex',
    status: 'ready',
    description: 'Codex fixture',
    model: 'gpt-5.3-codex',
    capabilities: { imageInput: true },
  },
  {
    id: 'qoder',
    name: 'Qoder',
    status: 'unavailable',
    description: 'Qoder fixture',
  },
];

export function detail(): ConversationDetail {
  return {
    conversation: {
      id: 'conversation-1',
      providerId: 'codex',
      model: 'gpt-5.4-codex',
      title: 'Existing conversation',
      preview: 'Existing answer',
      status: 'idle',
      createdAt: '2026-07-30T00:00:00.000Z',
      updatedAt: '2026-07-30T00:00:00.000Z',
    },
    messages: [
      {
        id: 'message-1',
        role: 'assistant',
        text: 'Existing answer',
        createdAt: '2026-07-30T00:00:00.000Z',
      },
    ],
  };
}

export class AppClient implements SidepanelClient {
  readonly requests: SidePanelRequest[] = [];
  readonly requestedOrigins: string[][] = [];
  readonly listeners = new Set<(message: SidepanelRuntimeMessage) => void>();
  stored: Record<string, unknown> = { 'panerelay.locale': 'en' };
  status = readyStatus;
  providers = readyProviders;
  history: ConversationDetail[] = [];
  historyError = '';
  prepareError = '';
  statusError = '';
  installError = '';
  installPromise: Promise<void> | null = null;
  providerDiscoveryPromise: Promise<void> | null = null;
  storagePromise: Promise<void> | null = null;
  sendHandler:
    | ((message: Extract<SidePanelRequest, { type: 'panerelay.conversation.send' }>) => Promise<{
        success: true;
        conversation: ConversationDetail;
        turnId: string;
        workspace: ConversationWorkspaceSnapshot;
      }>)
    | undefined;
  workspace: ConversationWorkspaceSnapshot = {
    kind: 'draft',
    providerId: 'codex',
    revision: 'workspace-1',
  };
  nextWorkspace = 1;

  async getStored(): Promise<Record<string, unknown>> {
    if (this.storagePromise) await this.storagePromise;
    return this.stored;
  }

  async setStored(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.stored, values);
  }

  async request(message: SidePanelRequest) {
    this.requests.push(message);
    switch (message.type) {
      case 'panerelay.status.get':
        if (this.statusError) throw new Error(this.statusError);
        return { success: true as const, status: this.status };
      case 'panerelay.fetch-authorization.set':
        this.status = {
          ...this.status,
          fetchAuthorization:
            message.scope === 'all-domains'
              ? { ...this.status.fetchAuthorization, allDomains: message.enabled }
              : {
                  ...this.status.fetchAuthorization,
                  domains: message.enabled
                    ? [...new Set([...this.status.fetchAuthorization.domains, message.domain])]
                    : this.status.fetchAuthorization.domains.filter(
                        domain => domain !== message.domain,
                      ),
                },
        };
        return { success: true as const, status: this.status };
      case 'panerelay.agent.providers':
        if (this.providerDiscoveryPromise) await this.providerDiscoveryPromise;
        return { success: true as const, providers: this.providers };
      case 'panerelay.agent.prepare':
        if (this.prepareError) throw new Error(this.prepareError);
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
      case 'panerelay.conversation.list':
        if (this.historyError) throw new Error(this.historyError);
        return {
          success: true as const,
          conversations: this.history.map(item => item.conversation),
        };
      case 'panerelay.conversation-timeline.load':
        return { success: true as const, timeline: { snapshot: null, events: [] } };
      case 'panerelay.conversation-timeline.save':
        return { success: true as const };
      case 'panerelay.conversation.resume': {
        const conversation =
          this.history.find(item => item.conversation.id === message.conversationId) ?? detail();
        this.workspace = {
          kind: 'conversation',
          providerId: message.providerId,
          conversationId: conversation.conversation.id,
          revision: `workspace-${++this.nextWorkspace}`,
        };
        return {
          success: true as const,
          conversation,
          workspace: this.workspace,
        };
      }
      case 'panerelay.conversation.send':
        if (this.sendHandler) return this.sendHandler(message);
        if (!message.conversationId) {
          const conversation = detail();
          this.workspace = {
            kind: 'conversation',
            providerId: message.providerId,
            conversationId: conversation.conversation.id,
            revision: `workspace-${++this.nextWorkspace}`,
          };
          return {
            success: true as const,
            conversation,
            turnId: 'turn-1',
            workspace: this.workspace,
          };
        }
        return { success: true as const, turnId: 'turn-1', workspace: this.workspace };
      case 'panerelay.authorization.set':
        this.status = {
          ...this.status,
          authorizationMode: message.mode,
          authorizedOriginPatterns: message.mode === 'none' ? [] : ['https://example.com/*'],
          authorizedTab: message.mode === 'single-tab' ? this.status.activeTab : null,
        };
        return { success: true as const, status: this.status };
      case 'panerelay.control.release':
        this.status = {
          ...this.status,
          controlledTab: null,
          controlledTabs: [],
          controlSession: null,
        };
        return { success: true as const, status: this.status };
      case 'panerelay.native.retry':
      case 'panerelay.host-update.retry':
        return { success: true as const, status: this.status };
      case 'panerelay.integration.install':
        if (this.installPromise) await this.installPromise;
        if (this.installError) throw new Error(this.installError);
        this.status = {
          ...this.status,
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
        };
        return { success: true as const, status: this.status };
      case 'panerelay.default-provider.set':
        this.status = {
          ...this.status,
          defaultProvider: {
            available: true,
            provider: message.enabled ? 'panerelay' : null,
            isPanerelay: message.enabled,
          },
        };
        return { success: true as const, status: this.status };
      case 'panerelay.browser-use-default.set':
        this.status = {
          ...this.status,
          browserUseDefault: {
            available: true,
            mode: message.enabled ? 'extension' : 'direct',
            isPanerelay: message.enabled,
          },
        };
        return { success: true as const, status: this.status };
      case 'panerelay.browser-default.set':
        this.status = {
          ...this.status,
          browserDefault: {
            ...this.status.browserDefault!,
            defaultBrowserId: message.enabled ? 'edge-browser-id' : null,
            isCurrentBrowser: message.enabled,
          },
        };
        return { success: true as const, status: this.status };
      case 'panerelay.browser-default.refresh':
        return { success: true as const, status: this.status };
      case 'panerelay.browser-use-default.refresh':
        return { success: true as const, status: this.status };
      case 'panerelay.controlled-tab.activate':
      case 'panerelay.controlled-tab.close':
      case 'panerelay.page-comments.start':
      case 'panerelay.page-comments.appearance':
      case 'panerelay.page-comments.stop':
      case 'panerelay.page-comments.edit':
      case 'panerelay.page-comments.remove':
      case 'panerelay.page-comments.clear':
        return { success: true as const };
      case 'panerelay.conversation.interrupt':
      case 'panerelay.conversation.respond':
        return { success: true as const };
    }
  }

  async requestOrigins(origins: string[]): Promise<boolean> {
    this.requestedOrigins.push(origins);
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

export async function renderReady(client = new AppClient()) {
  const user = userEvent.setup();
  render(<SidepanelApp client={client} />);
  await screen.findByRole('heading', { name: 'What should Codex do?' });
  return { client, user };
}
