import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SidepanelApp } from './app.js';
import { AppClient, detail, readyProviders, renderReady } from './app.test-support.js';
import { createProviderBootstrap, providerCacheValue } from './provider-selection.js';

describe('React Side Panel shell and providers', () => {
  it('shows the cached provider with a neutral status while live discovery starts', () => {
    const client = new AppClient();
    client.storagePromise = new Promise(() => undefined);
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

    render(<SidepanelApp bootstrap={bootstrap} client={client} />);

    expect(
      screen.getByRole('button', {
        name: 'Agent provider: Qoder, Connecting…, Current model: qoder-model',
      }),
    ).toBeVisible();
    expect(screen.queryByText('Codex unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('Qoder unavailable')).not.toBeInTheDocument();
  });

  it('does not report cached readiness between Extension status and live provider discovery', async () => {
    const client = new AppClient();
    let releaseDiscovery: (() => void) | undefined;
    client.providerDiscoveryPromise = new Promise<void>(resolve => {
      releaseDiscovery = resolve;
    });
    client.providers = readyProviders.map(provider =>
      provider.id === 'qoder' ? { ...provider, status: 'ready', model: 'qoder-model' } : provider,
    );
    client.workspace = {
      kind: 'draft',
      providerId: 'qoder',
      revision: 'qoder-workspace',
    };
    const cache = providerCacheValue([
      {
        id: 'qoder',
        name: 'Qoder',
        status: 'ready',
        description: 'Qoder fixture',
        model: 'qoder-model',
      },
    ]);
    client.stored = {
      'panerelay.agentProvider': 'qoder',
      'panerelay.agentProviders.v1': cache,
      'panerelay.locale': 'en',
    };
    const bootstrap = createProviderBootstrap('qoder', cache);

    render(<SidepanelApp bootstrap={bootstrap} client={client} />);
    await waitFor(() =>
      expect(client.requests).toContainEqual({ type: 'panerelay.agent.providers' }),
    );

    expect(
      screen.getByRole('button', {
        name: 'Agent provider: Qoder, Connecting…, Current model: qoder-model',
      }),
    ).toBeVisible();
    expect(screen.queryByText('qoder-model · Connected')).not.toBeInTheDocument();

    releaseDiscovery?.();
    await screen.findByText('qoder-model · Connected');
  });

  it('renders the compact English welcome state and fills a suggestion', async () => {
    const { user } = await renderReady();

    expect(
      screen.getByText(
        'Chat with a local agent and let it work in the browser scope you authorize.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Summarize this page' })).toBeVisible();
    expect(screen.getByText('No tab authorized')).toBeVisible();
    expect(screen.getByText('gpt-5.3-codex · Connected')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Summarize this page' }));
    expect(screen.getByRole('textbox')).toHaveValue(
      'Summarize the current page and highlight the most useful details.',
    );
  });

  it('shows the active conversation model instead of the provider default', async () => {
    const client = new AppClient();
    client.history = [detail()];
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    await user.click(await screen.findByRole('button', { name: /Existing conversation/ }));

    expect(await screen.findByText('gpt-5.4-codex · Connected')).toBeVisible();
    expect(screen.getByTitle('Current model: gpt-5.4-codex')).toBeVisible();
  });

  it('copies an ordered structured diagnostic record without issuing a runtime request', async () => {
    const client = new AppClient();
    client.history = [detail()];
    const { user } = await renderReady(client);
    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    expect(
      screen.queryByRole('button', { name: 'Copy conversation diagnostics' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Browser access:/ }));

    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    await user.click(await screen.findByRole('button', { name: /Existing conversation/ }));
    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'activity.updated',
          conversationId: 'conversation-1',
          turnId: 'turn-copy',
          activity: {
            id: 'tool-copy',
            kind: 'browser',
            title: 'agent-browser snapshot',
            status: 'completed',
            output: 'private page snapshot',
          },
        },
      });
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'message.delta',
          conversationId: 'conversation-1',
          turnId: 'turn-copy',
          messageId: 'message-after-tool',
          delta: 'Result after tool',
          phase: 'final',
        },
      });
    });

    await waitFor(() =>
      expect(
        client.requests
          .filter(request => request.type === 'panerelay.conversation-timeline.save')
          .at(-1),
      ).toMatchObject({
        snapshot: {
          timeline: expect.arrayContaining([
            expect.objectContaining({
              type: 'message',
              message: expect.objectContaining({ id: 'message-after-tool' }),
            }),
          ]),
        },
      }),
    );

    await user.click(screen.getByRole('button', { name: /Browser access:/ }));
    const requestsBeforeCopy = [...client.requests];
    const diagnosticCopy = screen.getByRole('button', {
      name: 'Copy conversation diagnostics',
    });
    expect(diagnosticCopy.nextElementSibling).toBe(screen.getByRole('link', { name: 'GitHub' }));
    await user.click(diagnosticCopy);

    const record = JSON.parse(await navigator.clipboard.readText()) as {
      schema: string;
      version: number;
      provider: { id: string };
      conversation: { id: string };
      browserContext: {
        activeTab: { id: number; title: string; url: string } | null;
        control: { tab: { id: number } | null; tabs: Array<{ id: number }> };
      };
      capture: {
        load: { source: string; conversationId: string };
        eventTrace: Array<{ sequence: number; kind: string; turnId?: string }>;
      };
      timeline: Array<{
        index: number;
        type: string;
        id: string;
        text?: string;
        turnId?: string;
        outputSummary?: { characterCount: number; lineCount: number };
      }>;
    };
    expect(record.schema).toBe('panerelay.conversation-diagnostics');
    expect(record.version).toBe(3);
    expect(record.provider.id).toBe('codex');
    expect(record.conversation.id).toBe('conversation-1');
    expect(record.browserContext.activeTab).toEqual({
      id: 8,
      title: 'Fixture page',
      url: 'https://example.com/page',
    });
    expect(record.browserContext.control).toMatchObject({ tab: null, tabs: [] });
    expect(record.capture.load).toEqual(
      expect.objectContaining({ source: 'provider-resume', conversationId: 'conversation-1' }),
    );
    expect(record.capture.eventTrace).toEqual([
      expect.objectContaining({ sequence: 1, kind: 'activity.updated', turnId: 'turn-copy' }),
      expect.objectContaining({ sequence: 2, kind: 'message.delta', turnId: 'turn-copy' }),
    ]);
    expect(record.timeline).toEqual([
      expect.objectContaining({ index: 0, type: 'message', id: 'message-1' }),
      expect.objectContaining({
        index: 1,
        type: 'activity',
        id: 'tool-copy',
        turnId: 'turn-copy',
        outputSummary: { characterCount: 21, lineCount: 1 },
      }),
      expect.objectContaining({
        index: 2,
        type: 'message',
        id: 'message-after-tool',
        text: 'Result after tool',
      }),
    ]);
    expect(await navigator.clipboard.readText()).not.toContain('private page snapshot');
    expect(client.requests).toEqual(requestsBeforeCopy);
    expect(screen.getByRole('button', { name: 'Conversation diagnostics copied' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Conversation diagnostics copied');
  });

  it('announces a retryable diagnostic clipboard failure', async () => {
    const client = new AppClient();
    client.history = [detail()];
    const { user } = await renderReady(client);
    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    await user.click(await screen.findByRole('button', { name: /Existing conversation/ }));
    await user.click(screen.getByRole('button', { name: /Browser access:/ }));

    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new Error('clipboard denied'));
    const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });
    const conversationBeforeCopy = screen.getByText('Existing answer').textContent;

    try {
      await user.click(screen.getByRole('button', { name: 'Copy conversation diagnostics' }));
      expect(
        screen.getByRole('button', { name: 'Could not copy conversation diagnostics' }),
      ).toBeVisible();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Could not copy conversation diagnostics',
      );
      expect(screen.getByText('Existing answer')).toHaveTextContent(conversationBeforeCopy || '');
    } finally {
      writeText.mockRestore();
      if (execCommandDescriptor) {
        Object.defineProperty(document, 'execCommand', execCommandDescriptor);
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }
  });

  it('omits model copy when a ready provider has not reported one', async () => {
    const client = new AppClient();
    client.providers = readyProviders.map(provider => {
      if (provider.id !== 'codex') return provider;
      const { model: _model, ...withoutModel } = provider;
      return withoutModel;
    });

    await renderReady(client);

    expect(screen.getByText('Connected')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Agent provider: Codex, Connected' })).toBeVisible();
    expect(screen.queryByText(/Provider default/)).not.toBeInTheDocument();
  });

  it('follows streamed output only while the user is following the bottom', async () => {
    const client = new AppClient();
    client.history = [detail()];
    const { user } = await renderReady(client);
    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    await user.click(await screen.findByRole('button', { name: /Existing conversation/ }));
    await screen.findByText('Existing answer');

    const scroll = document.querySelector('.chat-scroll') as HTMLElement;
    let scrollHeight = 1_000;
    Object.defineProperty(scroll, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    Object.defineProperty(scroll, 'clientHeight', { configurable: true, value: 200 });

    scroll.scrollTop = 800;
    fireEvent.scroll(scroll);
    scrollHeight = 1_100;
    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'message.delta',
          conversationId: 'conversation-1',
          turnId: 'turn-1',
          messageId: 'stream-1',
          delta: 'First streamed update',
        },
      });
    });
    await waitFor(() => expect(scroll.scrollTop).toBe(1_100));

    scroll.scrollTop = 300;
    fireEvent.scroll(scroll);
    scrollHeight = 1_200;
    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'message.delta',
          conversationId: 'conversation-1',
          turnId: 'turn-1',
          messageId: 'stream-1',
          delta: ' while reading older content',
        },
      });
    });
    await screen.findByText('First streamed update while reading older content');
    expect(scroll.scrollTop).toBe(300);

    await user.type(screen.getByRole('textbox'), 'Follow my new message');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(scroll.scrollTop).toBe(1_200));
  });

  it('renders Chinese copy and unavailable-provider setup guidance', async () => {
    const client = new AppClient();
    client.stored = { 'panerelay.locale': 'zh-CN' };
    client.providers = readyProviders.map(provider => ({ ...provider, status: 'unavailable' }));
    render(<SidepanelApp client={client} />);

    expect(await screen.findByRole('heading', { name: '配置 Codex' })).toBeVisible();
    expect(screen.getByRole('button', { name: '重试' }).closest('p')).toHaveTextContent(
      '安装或重新连接 Codex，然后重试。',
    );
    expect(screen.getByText('npm install -g @openai/codex')).toBeVisible();
    expect(screen.getByRole('button', { name: '重试' })).toHaveClass('provider-discovery-inline');
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('keeps browser authorization available when the selected provider is not installed', async () => {
    const { client, user } = await renderReady();

    await user.click(screen.getByRole('button', { name: /Agent provider: Codex/ }));
    await user.click(screen.getByRole('option', { name: 'Qoder · Not installed' }));

    expect(await screen.findByRole('heading', { name: 'Set up Qoder' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Agent provider: Qoder, Qoder unavailable' }),
    ).toBeVisible();
    expect(screen.queryByText(/Provider default/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Summarize this page' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByText('No tab authorized')).toBeVisible();
    expect(
      client.requests.filter(request => request.type === 'panerelay.authorization.set'),
    ).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Browser authorization' }));
    await user.click(screen.getByRole('option', { name: 'All tabs' }));

    await waitFor(() => expect(client.status.authorizationMode).toBe('all-tabs'));
    expect(screen.getByText('All web tabs authorized')).toBeVisible();
  });

  it('lists installed providers before unavailable providers', async () => {
    const client = new AppClient();
    client.providers = [
      {
        id: 'codex',
        name: 'Codex',
        status: 'unavailable',
        description: 'Codex fixture',
      },
      {
        id: 'claude',
        name: 'Claude Code',
        status: 'unavailable',
        description: 'Claude fixture',
      },
      {
        id: 'qoder',
        name: 'Qoder',
        status: 'ready',
        description: 'Qoder fixture',
      },
      {
        id: 'opencode',
        name: 'OpenCode',
        status: 'ready',
        description: 'OpenCode fixture',
      },
    ];
    const user = userEvent.setup();
    render(<SidepanelApp client={client} />);

    await user.click(await screen.findByRole('button', { name: /Agent provider: Codex/ }));

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Qoder · Ready',
      'OpenCode · Ready',
      'Codex · Not installed',
      'Claude Code · Not installed',
    ]);
  });

  it('shows localized OpenCode install, login, and ACP documentation guidance', async () => {
    const { client, user } = await renderReady();

    await user.click(screen.getByRole('button', { name: /Agent provider: Codex/ }));
    await user.click(screen.getByRole('option', { name: 'OpenCode · Not installed' }));

    expect(await screen.findByRole('heading', { name: 'Set up OpenCode' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'retry' }).closest('p')).toHaveTextContent(
      'Install OpenCode, run opencode auth login, then run npx --yes @panerelay/setup and retry.',
    );
    expect(screen.getByText('npm install -g opencode-ai')).toBeVisible();
    expect(screen.getByText('opencode auth login')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open setup documentation' })).toHaveAttribute(
      'href',
      'https://opencode.ai/docs/acp/',
    );

    const requestsBeforeRediscovery = client.requests.length;
    client.providers = [
      ...readyProviders,
      {
        id: 'opencode',
        name: 'OpenCode',
        status: 'ready',
        description: 'OpenCode fixture',
      },
    ];
    await user.click(screen.getByRole('button', { name: 'retry' }));

    expect(await screen.findByRole('heading', { name: 'What should OpenCode do?' })).toBeVisible();
    expect(client.requests.slice(requestsBeforeRediscovery)).toEqual([
      { type: 'panerelay.agent.providers' },
    ]);
    expect(client.status.authorizationMode).toBe('none');
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
});
