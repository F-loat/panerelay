import type { ConversationApproval } from '@panerelay/protocol';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SidepanelApp } from './app.js';
import { AppClient, detail, readyStatus, renderReady } from './app.test-support.js';

describe('React Side Panel conversation presentation', () => {
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
    const completedActivity = screen.getByText('panerelay · agent_browser_read').closest('details');
    expect(completedActivity).not.toHaveAttribute('open');
    expect(
      within(completedActivity as HTMLElement).getByText('panerelay_browser · agent_browser_read'),
    ).not.toBeVisible();
    await user.click(
      within(completedActivity as HTMLElement).getByLabelText(/Show or hide activity details/),
    );
    expect(completedActivity).toHaveAttribute('open');
    expect(
      within(completedActivity as HTMLElement).getByText('panerelay_browser · agent_browser_read'),
    ).toBeVisible();
    expect(within(completedActivity as HTMLElement).getAllByText('snapshot')).toHaveLength(2);
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
    expect(activityDetails?.querySelector('.activity-chevron')).toBeVisible();
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
          kind: 'error',
          conversationId: 'conversation-1',
          message: 'Qoder prompt timed out',
        },
      });
    });
    const timelineError = document.querySelector('.timeline-error');
    expect(timelineError).toHaveClass('mx-2');
    expect(timelineError).not.toHaveAttribute('open');
    await user.click(within(timelineError as HTMLElement).getByLabelText('Show error details'));
    expect(timelineError).toHaveAttribute('open');
    expect(
      within(timelineError as HTMLElement).getAllByText('Qoder prompt timed out'),
    ).toHaveLength(2);

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
