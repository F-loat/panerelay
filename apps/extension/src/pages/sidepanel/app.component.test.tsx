import type {
  AgentProviderSummary,
  ConversationApproval,
  ConversationDetail,
} from '@panerelay/protocol';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ExtensionStatus, SidePanelRequest } from '../../shared/messages.js';
import type { ConversationWorkspaceSnapshot } from '../../shared/conversation-workspaces.js';
import { SidepanelApp } from './app.js';
import type { SidepanelClient, SidepanelRuntimeMessage } from './sidepanel-client.js';

const readyStatus: ExtensionStatus = {
  bridgeConnected: true,
  nativeHostState: 'connected',
  defaultProvider: { provider: null, isPanerelay: false },
  authorizationRequest: null,
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

const readyProviders: AgentProviderSummary[] = [
  {
    id: 'codex',
    name: 'Codex',
    status: 'ready',
    description: 'Codex fixture',
  },
  {
    id: 'qoder',
    name: 'Qoder',
    status: 'unavailable',
    description: 'Qoder fixture',
  },
];

function detail(): ConversationDetail {
  return {
    conversation: {
      id: 'conversation-1',
      providerId: 'codex',
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

class AppClient implements SidepanelClient {
  readonly requests: SidePanelRequest[] = [];
  readonly listeners = new Set<(message: SidepanelRuntimeMessage) => void>();
  stored: Record<string, unknown> = { 'panerelay.locale': 'en' };
  status = readyStatus;
  providers = readyProviders;
  history: ConversationDetail[] = [];
  historyError = '';
  prepareError = '';
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
    return this.stored;
  }

  async setStored(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.stored, values);
  }

  async request(message: SidePanelRequest) {
    this.requests.push(message);
    switch (message.type) {
      case 'panerelay.status.get':
        return { success: true as const, status: this.status };
      case 'panerelay.agent.providers':
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
      case 'panerelay.conversation.list':
        if (this.historyError) throw new Error(this.historyError);
        return {
          success: true as const,
          conversations: this.history.map(item => item.conversation),
        };
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
      case 'panerelay.native.retry':
        return { success: true as const, status: this.status };
      case 'panerelay.default-provider.set':
        this.status = {
          ...this.status,
          defaultProvider: {
            provider: message.enabled ? 'panerelay' : null,
            isPanerelay: message.enabled,
          },
        };
        return { success: true as const, status: this.status };
      case 'panerelay.controlled-tab.activate':
      case 'panerelay.controlled-tab.close':
        return { success: true as const };
      case 'panerelay.conversation.interrupt':
      case 'panerelay.conversation.respond':
        return { success: true as const };
    }
  }

  async requestOrigins(): Promise<boolean> {
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

async function renderReady(client = new AppClient()) {
  const user = userEvent.setup();
  render(<SidepanelApp client={client} />);
  await screen.findByRole('heading', { name: 'What should Codex do?' });
  return { client, user };
}

describe('React Side Panel', () => {
  it('renders the compact English welcome state and fills a suggestion', async () => {
    const { user } = await renderReady();

    expect(
      screen.getByText(
        'Chat with a local agent and let it work in the browser scope you authorize.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Summarize this page' })).toBeVisible();
    expect(screen.getByText('No tab authorized')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Summarize this page' }));
    expect(screen.getByRole('textbox')).toHaveValue(
      'Summarize the current page and highlight the most useful details.',
    );
  });

  it('renders Chinese copy and unavailable-provider setup guidance', async () => {
    const client = new AppClient();
    client.stored = { 'panerelay.locale': 'zh-CN' };
    client.providers = readyProviders.map(provider => ({ ...provider, status: 'unavailable' }));
    render(<SidepanelApp client={client} />);

    expect(await screen.findByRole('heading', { name: '配置 Codex' })).toBeVisible();
    expect(screen.getByText('安装或重新连接 Codex，然后重试 Provider 检测。')).toBeVisible();
    expect(screen.getByText('npm install -g @openai/codex')).toBeVisible();
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('uses the Chrome UI language when the user has not chosen one', async () => {
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'zh-CN' } });
    const client = new AppClient();
    client.stored = {};

    try {
      render(<SidepanelApp client={client} />);
      expect(await screen.findByRole('heading', { name: '想让 Codex 做什么？' })).toBeVisible();
      expect(document.documentElement.lang).toBe('zh-CN');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('opens settings, changes authorization, and persists language', async () => {
    const { client, user } = await renderReady();

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    expect(screen.getByText('Settings')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'All tabs' }));
    await waitFor(() => expect(client.status.authorizationMode).toBe('all-tabs'));
    expect(screen.getAllByText('All web tabs authorized').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Language' }));
    await user.click(screen.getByRole('option', { name: '中文' }));
    expect(await screen.findByText('设置')).toBeVisible();
    expect(client.stored['panerelay.locale']).toBe('zh-CN');
  });

  it('sets and clears the user-level default Provider from settings', async () => {
    const { client, user } = await renderReady();

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    expect(screen.getByText('Default Provider')).toBeVisible();
    expect(screen.getByText('agent-browser')).toBeVisible();
    expect(screen.queryByText('Native Host unavailable')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set default' }));

    await waitFor(() =>
      expect(client.requests).toContainEqual({
        type: 'panerelay.default-provider.set',
        enabled: true,
      }),
    );
    expect(screen.getByRole('button', { name: 'Clear default' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Clear default' }));
    expect(client.requests).toContainEqual({
      type: 'panerelay.default-provider.set',
      enabled: false,
    });
  });

  it('guides a missing Native Host with setup and retry', async () => {
    const client = new AppClient();
    client.status = {
      ...readyStatus,
      bridgeConnected: false,
      nativeHostState: 'missing',
      defaultProvider: null,
      error: 'Specified native messaging host not found.',
    };
    const user = userEvent.setup();
    render(<SidepanelApp client={client} />);

    expect(await screen.findByText('Install the Panerelay integration')).toBeVisible();
    expect(screen.getByText('npx --yes @panerelay/setup')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry connection' }));
    expect(client.requests).toContainEqual({ type: 'panerelay.native.retry' });
  });

  it('surfaces authorization requests and controlled-tab actions', async () => {
    const client = new AppClient();
    client.status = {
      ...readyStatus,
      authorizationRequest: 'all-tabs',
      controlledTab: { id: 9, title: 'Controlled fixture', url: 'https://example.com/controlled' },
      controlledTabs: [
        { id: 9, title: 'Controlled fixture', url: 'https://example.com/controlled' },
      ],
      controlSession: {
        id: 'control-1',
        actor: { kind: 'automation', name: 'agent-browser' },
        state: 'active',
        controlledTargetCount: 1,
        heartbeatFreshness: 'fresh',
        updatedAt: '2026-07-30T05:27:00.000Z',
      },
    };
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: 'Authorize all tabs' }));
    expect(client.requests).toContainEqual({
      type: 'panerelay.authorization.set',
      mode: 'all-tabs',
    });

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    const externalControl = screen.getByText('External control').closest('section');
    expect(externalControl).not.toBeNull();
    expect(
      within(externalControl as HTMLElement).queryByRole('button', { name: 'Release' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand external control details' }));
    await user.click(screen.getByRole('button', { name: 'Activate Controlled fixture' }));
    await user.click(screen.getByRole('button', { name: 'Close Controlled fixture' }));

    expect(client.requests).toContainEqual({
      type: 'panerelay.controlled-tab.activate',
      tabId: 9,
    });
    expect(client.requests).toContainEqual({
      type: 'panerelay.controlled-tab.close',
      tabId: 9,
    });
  });

  it('keeps external control activity collapsed until the summary is opened', async () => {
    const client = new AppClient();
    client.status = {
      ...readyStatus,
      controlSession: {
        id: 'control-1',
        actor: {
          kind: 'automation',
          name: 'agent-browser',
          sessionLabel: 'panerelay-summary',
        },
        state: 'released',
        controlledTargetCount: 0,
        heartbeatFreshness: 'unknown',
        updatedAt: '2026-07-30T05:27:00.000Z',
      },
      automationActivities: [
        {
          id: 'activity-1',
          sessionId: 'control-1',
          actor: { kind: 'automation', name: 'agent-browser' },
          category: 'target',
          label: 'manage-target',
          status: 'completed',
          sequence: 1,
          startedAt: '2026-07-30T05:27:00.000Z',
          updatedAt: '2026-07-30T05:27:01.000Z',
        },
      ],
    };
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    const toggle = screen.getByRole('button', { name: 'Expand external control details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Manage tabs')).not.toBeVisible();

    await user.click(toggle);
    expect(screen.getByText('Manage tabs')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Collapse external control details' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('creates and sends a draft atomically on the first message', async () => {
    const { client, user } = await renderReady();
    const input = screen.getByRole('textbox');
    await user.type(input, 'Inspect the page');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Inspect the page')).toBeVisible();
    expect(client.requests).toContainEqual({
      type: 'panerelay.conversation.send',
      providerId: 'codex',
      expectedRevision: 'workspace-1',
      text: 'Inspect the page',
    });
  });

  it('shows live feedback while a draft conversation starts and while its turn is pending', async () => {
    const client = new AppClient();
    let resolveSend!: (value: {
      success: true;
      conversation: ConversationDetail;
      turnId: string;
      workspace: ConversationWorkspaceSnapshot;
    }) => void;
    client.sendHandler = () =>
      new Promise(resolve => {
        resolveSend = resolve;
      });
    const { user } = await renderReady(client);

    await user.type(screen.getByRole('textbox'), 'Inspect the page');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Starting a new Codex conversation…')).toBeVisible();
    expect(
      screen.getByText('The first response can take a moment while the session is created.'),
    ).toBeVisible();

    const conversation = detail();
    const workspace: ConversationWorkspaceSnapshot = {
      kind: 'conversation',
      providerId: 'codex',
      conversationId: conversation.conversation.id,
      revision: 'workspace-2',
    };
    await act(async () => {
      resolveSend({
        success: true,
        conversation,
        turnId: 'turn-1',
        workspace,
      });
    });

    expect(await screen.findByText('Codex is working…')).toBeVisible();
    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'message.delta',
          conversationId: conversation.conversation.id,
          turnId: 'turn-1',
          messageId: 'assistant-progress',
          delta: 'I am checking the page.',
        },
      });
    });
    expect(await screen.findByText('I am checking the page.')).toBeVisible();
    expect(screen.queryByText('Codex is working…')).not.toBeInTheDocument();

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'turn.completed',
          conversationId: conversation.conversation.id,
          turnId: 'turn-1',
          status: 'completed',
        },
      });
    });
    expect(screen.queryByText('Starting a new Codex conversation…')).not.toBeInTheDocument();
  });

  it('renders activity, approvals, and global errors from runtime events', async () => {
    const client = new AppClient();
    client.history = [detail()];
    const user = userEvent.setup();
    render(<SidepanelApp client={client} />);
    await screen.findByRole('heading', { name: 'What should Codex do?' });
    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    expect(await screen.findByText('Existing conversation')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Existing conversation/ }));
    expect(await screen.findByText('Existing answer')).toBeVisible();

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'activity.updated',
          conversationId: 'conversation-1',
          turnId: 'turn-1',
          activity: {
            id: 'activity-1',
            kind: 'browser',
            title: 'panerelay_browser · agent_browser_read',
            detail: 'snapshot',
            status: 'completed',
          },
        },
      });
    });
    expect(screen.getByText('panerelay · agent_browser_read')).toBeVisible();
    expect(screen.queryByText('panerelay_browser · agent_browser_read')).not.toBeInTheDocument();

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'activity.updated',
          conversationId: 'conversation-1',
          turnId: 'turn-1',
          activity: {
            id: 'activity-setup',
            kind: 'browser',
            title: 'agent-browser',
            detail: "Plugin 'panerelay' returned success=false",
            status: 'failed',
          },
        },
      });
    });
    expect(screen.getByText('Panerelay setup needed')).toBeVisible();
    expect(screen.getByText('npx --yes @panerelay/setup')).toBeVisible();

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'error',
          conversationId: 'conversation-1',
          message: 'Qoder prompt timed out',
        },
      });
    });
    expect(screen.getByText('Qoder prompt timed out').closest('article')).toHaveClass('mx-2');

    const approval: ConversationApproval = {
      id: 'approval-1',
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      kind: 'command',
      title: 'Run fixture command',
      decisions: ['accept', 'declineForSession'],
    };
    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'approval.requested',
          conversationId: 'conversation-1',
          turnId: 'turn-1',
          approval,
        },
      });
    });
    expect(screen.getByText('Run fixture command')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Allow once' }));
    expect(screen.queryByText('Run fixture command')).not.toBeInTheDocument();

    act(() => {
      client.emit({
        type: 'panerelay.status.changed',
        status: { ...readyStatus, error: 'Native Host disconnected' },
      });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Native Host disconnected');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders indented and compact fenced code blocks', async () => {
    const client = new AppClient();
    const conversation = detail();
    conversation.messages = [
      {
        id: 'message-code',
        role: 'assistant',
        text: [
          '**Fastest install:**',
          '',
          '  ```bash npx --yes @panerelay/setup --global-provider ``` Install the Extension.',
          '',
          '  ```bash',
          'agent-browser --provider panerelay tab list',
          '  ```',
          '',
          'Run `pnpm run check` before release.',
        ].join('\n'),
        createdAt: '2026-07-30T00:00:00.000Z',
      },
    ];
    client.history = [conversation];
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    await user.click(await screen.findByRole('button', { name: /Existing conversation/ }));

    const codeBlocks = Array.from(document.querySelectorAll('.rich-text pre code'));
    expect(codeBlocks).toHaveLength(2);
    expect(codeBlocks[0]).toHaveTextContent('npx --yes @panerelay/setup --global-provider');
    expect(codeBlocks[1]).toHaveTextContent('agent-browser --provider panerelay tab list');
    expect(document.querySelector('.rich-text p code')).toHaveTextContent('pnpm run check');
    expect(screen.queryByText(/```bash/)).not.toBeInTheDocument();
  });

  it('loads history only when opened and filters recent conversations', async () => {
    const client = new AppClient();
    const second = detail();
    second.conversation = {
      ...second.conversation,
      id: 'conversation-2',
      title: 'Deploy release',
      preview: 'Package checks',
    };
    client.history = [detail(), second];
    const { user } = await renderReady(client);

    expect(client.requests.some(request => request.type === 'panerelay.conversation.list')).toBe(
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    expect(await screen.findByText('Existing conversation')).toBeVisible();
    expect(screen.getByText('Deploy release')).toBeVisible();
    expect(
      client.requests.filter(request => request.type === 'panerelay.conversation.list'),
    ).toHaveLength(1);

    await user.type(screen.getByRole('searchbox', { name: 'Search conversations' }), 'deploy');
    expect(screen.queryByText('Existing conversation')).not.toBeInTheDocument();
    expect(screen.getByText('Deploy release')).toBeVisible();
  });

  it('keeps a history loading failure inside the popover and retries it', async () => {
    const client = new AppClient();
    client.historyError = 'Codex history is temporarily unavailable';
    client.history = [detail()];
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    expect(await screen.findByText('Codex history is temporarily unavailable')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    client.historyError = '';
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Existing conversation')).toBeVisible();
    expect(
      client.requests.filter(request => request.type === 'panerelay.conversation.list'),
    ).toHaveLength(2);
  });

  it('keeps provider warm-up failures contextual and retryable', async () => {
    const client = new AppClient();
    client.prepareError = 'Codex app-server did not start';
    const { user } = await renderReady(client);

    expect((await screen.findAllByText('Could not start Codex')).length).toBeGreaterThan(0);
    expect(screen.getByText('Codex app-server did not start')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    client.prepareError = '';
    await user.click(screen.getByRole('button', { name: 'Retry connection' }));
    await waitFor(() => expect(screen.queryAllByText('Could not start Codex')).toHaveLength(0));
  });
});
