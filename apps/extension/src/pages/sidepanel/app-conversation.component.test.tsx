import type { ConversationApproval } from '@panerelay/protocol';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SidepanelApp } from './app.js';
import { AppClient, detail, readyStatus, renderReady } from './app.test-support.js';

describe('React Side Panel conversation presentation', () => {
  it('keeps streamed reasoning cards visible and ordered around activity output', async () => {
    const client = new AppClient();
    client.history = [detail()];
    const user = userEvent.setup();
    render(<SidepanelApp client={client} />);
    await screen.findByRole('heading', { name: 'What should Codex do?' });
    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    await user.click(await screen.findByRole('button', { name: /Existing conversation/ }));

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'turn.started',
          conversationId: 'conversation-1',
          turnId: 'turn-reasoning',
        },
      });
    });
    expect(document.querySelector('.turn-feedback')).toBeInTheDocument();

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'reasoning.delta',
          conversationId: 'conversation-1',
          turnId: 'turn-reasoning',
          itemId: 'reasoning-1',
          delta: 'Inspecting',
        },
      });
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'reasoning.delta',
          conversationId: 'conversation-1',
          turnId: 'turn-reasoning',
          itemId: 'reasoning-1',
          delta: ' the page',
        },
      });
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'reasoning.delta',
          conversationId: 'conversation-1',
          turnId: 'turn-reasoning',
          itemId: 'reasoning-1',
          delta:
            '\nold line 1\nold line 2\nrecent line 3\nrecent line 4\nrecent line 5\nrecent line 6\nlatest line 7',
        },
      });
    });
    expect(document.querySelector('.turn-feedback')).not.toBeInTheDocument();
    let reasoningCards = document.querySelectorAll('.reasoning-card');
    expect(reasoningCards).toHaveLength(1);
    expect(reasoningCards[0]).toHaveTextContent('Inspecting the page');
    expect(reasoningCards[0]).toHaveAttribute('data-active', 'true');
    expect(reasoningCards[0]).toHaveAttribute('open');
    expect(reasoningCards[0]?.querySelector('.reasoning-content')).toHaveTextContent(
      'latest line 7',
    );
    expect(reasoningCards[0]?.querySelector('.reasoning-content')).not.toHaveTextContent(
      'old line 1',
    );
    expect(reasoningCards[0]?.querySelector('.reasoning-content')).not.toHaveTextContent(
      'old line 2',
    );

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'activity.updated',
          conversationId: 'conversation-1',
          turnId: 'turn-reasoning',
          activity: {
            id: 'tool-between-reasoning',
            kind: 'tool',
            title: 'Read page',
            status: 'completed',
          },
        },
      });
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'reasoning.delta',
          conversationId: 'conversation-1',
          turnId: 'turn-reasoning',
          itemId: 'reasoning-2',
          delta: 'Checking the result',
        },
      });
    });

    reasoningCards = document.querySelectorAll('.reasoning-card');
    expect(reasoningCards).toHaveLength(2);
    const activity = screen.getAllByText('Read page')[0]?.closest('.activity-stack');
    expect(reasoningCards[0]?.compareDocumentPosition(activity!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(activity?.compareDocumentPosition(reasoningCards[1]!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(reasoningCards[0]).toHaveAttribute('data-active', 'false');
    expect(reasoningCards[0]).not.toHaveAttribute('open');
    expect(reasoningCards[1]).toHaveAttribute('data-active', 'true');
    expect(reasoningCards[1]).toHaveAttribute('open');
    expect(document.querySelector('.turn-feedback')).not.toBeInTheDocument();

    await user.click(reasoningCards[0]!.querySelector('summary')!);
    expect(reasoningCards[0]?.querySelector('.reasoning-content')).toHaveTextContent('old line 1');
    await user.click(reasoningCards[0]!.querySelector('summary')!);

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'turn.completed',
          conversationId: 'conversation-1',
          turnId: 'turn-reasoning',
          status: 'completed',
        },
      });
    });
    expect(reasoningCards[1]).toHaveAttribute('data-active', 'false');
    expect(reasoningCards[1]).not.toHaveAttribute('open');

    await user.click(reasoningCards[1]!.querySelector('summary')!);
    expect(reasoningCards[1]).toHaveAttribute('open');
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
            output: 'tab t1\nATA - 阿里技术分享平台',
            status: 'completed',
          },
        },
      });
    });
    const completedActivity = screen.getByText('panerelay · agent_browser_read').closest('details');
    expect(completedActivity).not.toHaveAttribute('open');
    expect(completedActivity?.querySelector('.activity-chevron')).toBeNull();
    expect(
      within(completedActivity as HTMLElement).getByText('panerelay_browser · agent_browser_read'),
    ).not.toBeVisible();
    expect(within(completedActivity as HTMLElement).getByText(/tab t1/)).not.toBeVisible();
    await user.click(
      within(completedActivity as HTMLElement).getByLabelText(/Show or hide activity details/),
    );
    expect(completedActivity).toHaveAttribute('open');
    expect(
      within(completedActivity as HTMLElement).getByText('panerelay_browser · agent_browser_read'),
    ).toBeVisible();
    expect(within(completedActivity as HTMLElement).getAllByText('snapshot')).toHaveLength(2);
    expect(within(completedActivity as HTMLElement).getByText(/tab t1/)).toBeVisible();
    expect(completedActivity?.querySelector('.activity-output-expanded')).toHaveTextContent(
      'ATA - 阿里技术分享平台',
    );
    await user.click(
      within(completedActivity as HTMLElement).getByLabelText(/Show or hide activity details/),
    );
    expect(completedActivity).not.toHaveAttribute('open');

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
    const activityDetails = screen.getAllByText('agent-browser')[0]?.closest('details');
    expect(activityDetails).not.toHaveAttribute('open');
    expect(activityDetails?.querySelector('.activity-chevron')).toBeNull();
    await user.click(
      within(activityDetails as HTMLElement).getByLabelText(/Show or hide activity details/),
    );
    expect(activityDetails).toHaveAttribute('open');
    expect(within(activityDetails as HTMLElement).getAllByText('agent-browser')).toHaveLength(2);
    expect(
      within(activityDetails as HTMLElement).getAllByText(
        "Plugin 'panerelay' returned success=false",
      ),
    ).toHaveLength(2);

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'activity.updated',
          conversationId: 'conversation-1',
          turnId: 'turn-1',
          activity: {
            id: 'activity-no-detail',
            kind: 'browser',
            title: 'Plain failure',
            status: 'failed',
          },
        },
      });
    });
    const plainFailure = screen.getAllByText('Plain failure')[0]?.closest('details');
    expect(plainFailure).toHaveClass('activity-card');
    expect(plainFailure).not.toHaveAttribute('open');
    await user.click(
      within(plainFailure as HTMLElement).getByLabelText(/Show or hide activity details/),
    );
    expect(plainFailure).toHaveAttribute('open');
    expect(within(plainFailure as HTMLElement).getAllByText('Plain failure')).toHaveLength(2);

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'activity.updated',
          conversationId: 'conversation-1',
          turnId: 'turn-1',
          activity: {
            id: 'activity-running',
            kind: 'command',
            title: 'Still running',
            status: 'running',
          },
        },
      });
    });
    expect(screen.getByText('Still running').closest('article')).toHaveClass('activity-card');
    expect(screen.getByText('Still running').closest('details')).toBeNull();

    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'turn.started',
          conversationId: 'conversation-1',
          turnId: 'turn-timeout',
        },
      });
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'error',
          conversationId: 'conversation-1',
          message: 'Qoder prompt timed out',
        },
      });
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'turn.completed',
          conversationId: 'conversation-1',
          turnId: 'turn-timeout',
          status: 'failed',
          error: 'Qoder prompt timed out',
        },
      });
    });
    const timelineErrors = document.querySelectorAll('.timeline-error');
    expect(timelineErrors).toHaveLength(1);
    const [timelineError] = timelineErrors;
    expect(timelineError).toHaveClass('mx-2');
    expect(timelineError).toHaveClass('activity-card', 'activity-card-expandable');
    expect(timelineError).not.toHaveAttribute('open');
    expect(timelineError?.querySelector('.timeline-error-chevron')).toBeNull();
    expect(within(timelineError as HTMLElement).getByText('failed')).toBeVisible();
    await user.click(within(timelineError as HTMLElement).getByLabelText('Show error details'));
    expect(timelineError).toHaveAttribute('open');
    expect(within(timelineError as HTMLElement).getByText('Qoder prompt timed out')).toBeVisible();
    expect(within(timelineError as HTMLElement).getByText('Request timeout')).toBeVisible();
    expect(
      within(timelineError as HTMLElement).getByText(
        'Check that the selected Agent is still running and connected, then try the request again.',
      ),
    ).toBeVisible();

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

  it('keeps a global error compact until its details are opened', async () => {
    const client = new AppClient();
    client.statusError = 'Native Host returned a detailed connection failure';
    const user = userEvent.setup();
    render(<SidepanelApp client={client} />);

    const alert = await screen.findByRole('alert');
    const disclosure = alert.querySelector('details');
    expect(disclosure).not.toHaveAttribute('open');
    await user.click(within(alert).getByLabelText('Show error details'));
    expect(disclosure).toHaveAttribute('open');
    expect(
      within(alert).getAllByText('Native Host returned a detailed connection failure'),
    ).toHaveLength(2);
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
          '  ```bash npx --yes @panerelay/setup --global-default ``` Install the Extension.',
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
    expect(codeBlocks[0]).toHaveTextContent('npx --yes @panerelay/setup --global-default');
    expect(codeBlocks[1]).toHaveTextContent('agent-browser --provider panerelay tab list');
    expect(document.querySelector('.rich-text p code')).toHaveTextContent('pnpm run check');
    expect(screen.queryByText(/```bash/)).not.toBeInTheDocument();
  });

  it('copies each user or assistant message as its original Markdown source', async () => {
    const client = new AppClient();
    const conversation = detail();
    const userMarkdown = '**Question** with `inline code`';
    const assistantMarkdown = [
      '## Result',
      '',
      '| Item | Status |',
      '| --- | --- |',
      '| Copy | done |',
      '',
      '```ts',
      'const copied = true;',
      '```',
    ].join('\n');
    conversation.messages = [
      {
        id: 'message-user-copy',
        role: 'user',
        text: userMarkdown,
        createdAt: '2026-08-04T00:00:00.000Z',
      },
      {
        id: 'message-assistant-copy',
        role: 'assistant',
        text: assistantMarkdown,
        createdAt: '2026-08-04T00:01:00.000Z',
      },
    ];
    client.history = [conversation];
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    await user.click(await screen.findByRole('button', { name: /Existing conversation/ }));

    const userCard = screen.getByTestId('message-message-user-copy');
    const assistantCard = screen.getByTestId('message-message-assistant-copy');
    const userCopy = within(userCard).getByRole('button', { name: 'Copy message as Markdown' });
    const assistantCopy = within(assistantCard).getByRole('button', {
      name: 'Copy message as Markdown',
    });
    expect(userCopy).toHaveClass('message-copy-button');
    expect(assistantCopy).toHaveClass('message-copy-button');

    assistantCopy.focus();
    expect(assistantCopy).toHaveFocus();
    await user.click(assistantCopy);
    expect(await navigator.clipboard.readText()).toBe(assistantMarkdown);
    expect(
      within(assistantCard).getByRole('button', { name: 'Message Markdown copied' }),
    ).toBeVisible();
    expect(within(assistantCard).getByRole('status')).toHaveTextContent('Message Markdown copied');

    await user.click(userCopy);
    expect(await navigator.clipboard.readText()).toBe(userMarkdown);
  });

  it('renders safe responsive Markdown tables and leaves malformed tables as text', async () => {
    const client = new AppClient();
    const conversation = detail();
    conversation.messages = [
      {
        id: 'message-table',
        role: 'assistant',
        text: [
          '| 文章 | 数据 | 时间 |',
          '| :--- | ---: | :---: |',
          '| **Skill 的第一道门槛** | `865 浏览` | [4月12日](https://example.com/skill) |',
          '| Mtop \\| DevTools | 505 浏览 | 1月21日 |',
          '| `cloud|agent` | 351 浏览 | 5月8日 |',
          '',
          '| not a table | still text |',
          '| -- | invalid |',
        ].join('\n'),
        createdAt: '2026-08-04T00:00:00.000Z',
      },
    ];
    client.history = [conversation];
    const { user } = await renderReady(client);

    await user.click(screen.getByRole('button', { name: 'Conversation history' }));
    await user.click(await screen.findByRole('button', { name: /Existing conversation/ }));

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3);
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getAllByRole('cell')).toHaveLength(9);
    const headers = within(table).getAllByRole('columnheader');
    expect(headers[0]).toHaveAttribute('data-align', 'left');
    expect(headers[1]).toHaveAttribute('data-align', 'right');
    expect(headers[2]).toHaveAttribute('data-align', 'center');
    expect(within(table).getByText('Skill 的第一道门槛').tagName).toBe('STRONG');
    expect(within(table).getByText('865 浏览').tagName).toBe('CODE');
    expect(within(table).getByRole('link', { name: '4月12日' })).toHaveAttribute(
      'href',
      'https://example.com/skill',
    );
    expect(within(table).getByText('Mtop | DevTools')).toBeVisible();
    expect(within(table).getByText('cloud|agent').tagName).toBe('CODE');
    expect(table.closest('.rich-table-scroll')).toHaveClass('rich-table-scroll');
    expect(document.querySelectorAll('.rich-text table')).toHaveLength(1);
    expect(screen.getByText(/not a table/).closest('p')).toHaveTextContent(
      '| not a table | still text |',
    );
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
