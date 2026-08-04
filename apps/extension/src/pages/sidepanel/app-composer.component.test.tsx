import type { ConversationDetail } from '@panerelay/protocol';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ConversationWorkspaceSnapshot } from '../../shared/conversation-workspaces.js';
import { AppClient, detail, readyProviders, renderReady } from './app.test-support.js';

describe('React Side Panel composer', () => {
  it('creates and sends a draft atomically on the first message', async () => {
    const { client, user } = await renderReady();
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('rows', '2');
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

  it('selects and clears a project before a conversation starts', async () => {
    const { client, user } = await renderReady();

    await user.click(screen.getByRole('button', { name: 'Select project' }));
    expect(await screen.findByText('project')).toBeVisible();
    expect(client.requests).toContainEqual({
      type: 'panerelay.workspace.pick-directory',
      expectedRevision: 'workspace-1',
    });

    await user.click(screen.getByRole('button', { name: 'Clear project' }));
    expect(await screen.findByRole('button', { name: 'Select project' })).toBeVisible();
    expect(client.requests).toContainEqual({
      type: 'panerelay.workspace.clear-directory',
      expectedRevision: 'workspace-2',
    });
  });

  it('shows page comments and automatic approval controls in the composer', async () => {
    const { client, user } = await renderReady();

    const commentButton = screen.getByRole('button', { name: 'Comment on page' });
    await user.click(commentButton);
    expect(client.requests).toContainEqual({
      type: 'panerelay.page-comments.start',
      locale: 'en',
      theme: 'light',
    });
    expect(screen.getByRole('button', { name: 'Stop commenting' })).toBeVisible();
    fireEvent.doubleClick(commentButton);
    await waitFor(() =>
      expect(client.requests).toContainEqual({
        type: 'panerelay.page-comments.start',
        continuous: true,
        locale: 'en',
        theme: 'light',
      }),
    );

    act(() => {
      client.emit({
        type: 'panerelay.page-comment.changed',
        source: 'panerelay-page-comments',
        comment: {
          id: 'comment-1',
          comment: 'Make this action clearer',
          page: { url: 'https://example.com/page', title: 'Fixture page' },
          element: {
            tagName: 'button',
            selector: 'main > button.primary',
            text: 'Continue',
            rect: { left: 10, top: 10, width: 100, height: 30 },
          },
        },
      });
    });
    expect(screen.getByText('Annotation 1')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit page comment' })).toHaveAttribute(
      'title',
      expect.stringContaining('Make this action clearer'),
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const send = client.requests.find(request => request.type === 'panerelay.conversation.send');
    if (send?.type !== 'panerelay.conversation.send') {
      throw new Error('Expected a conversation send request');
    }
    expect(send.text).toContain('Untrusted page evidence');
    expect(send.text).toContain('Make this action clearer');

    await user.click(screen.getByRole('button', { name: 'Enable automatic Agent approvals' }));
    expect(client.stored['panerelay.agentAutoApprove']).toBe(true);
    expect(screen.getByRole('button', { name: 'Disable automatic Agent approvals' })).toBeVisible();
  });

  it('pastes, previews, removes, and sends images without requiring text', async () => {
    const { client, user } = await renderReady();
    const input = screen.getByRole('textbox');
    const file = new File([new Uint8Array([1, 2, 3])], 'screenshot.png', {
      type: 'image/png',
    });
    const clipboardData = {
      items: [
        {
          kind: 'file',
          type: 'image/png',
          getAsFile: () => file,
        },
      ],
    };

    fireEvent.paste(input, { clipboardData });
    expect(await screen.findByAltText('screenshot.png')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(screen.queryByAltText('screenshot.png')).toBeNull();

    fireEvent.paste(input, { clipboardData });
    expect(await screen.findByAltText('screenshot.png')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(client.requests).toContainEqual({
      type: 'panerelay.conversation.send',
      providerId: 'codex',
      expectedRevision: 'workspace-1',
      text: '',
      images: [{ data: 'AQID', mimeType: 'image/png', name: 'screenshot.png' }],
    });
    expect(screen.queryByAltText('screenshot.png')).toBeNull();
  });

  it('rejects pasted images when the prepared provider does not support them', async () => {
    const client = new AppClient();
    client.providers = readyProviders.map(provider =>
      provider.id === 'codex'
        ? { ...provider, capabilities: { ...provider.capabilities, imageInput: false } }
        : provider,
    );
    await renderReady(client);
    const file = new File([new Uint8Array([1, 2, 3])], 'screenshot.png', {
      type: 'image/png',
    });

    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The selected Agent does not support image input.',
    );
    expect(screen.queryByAltText('screenshot.png')).toBeNull();
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
    expect(screen.getByText('Progress and results will appear here as they arrive.')).toBeVisible();
    act(() => {
      client.emit({
        type: 'panerelay.conversation.event',
        event: {
          kind: 'reasoning.delta',
          conversationId: conversation.conversation.id,
          turnId: 'turn-1',
          itemId: 'reasoning-1',
          delta: 'Checking the page structure before choosing an action.',
        },
      });
    });
    const workingStatus = screen.getByRole('status');
    expect(
      within(workingStatus).getByText('Checking the page structure before choosing an action.'),
    ).toBeVisible();
    expect(
      screen.queryByText('Progress and results will appear here as they arrive.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Reasoning')).not.toBeInTheDocument();

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
    expect(screen.getByText('Reasoning')).toBeVisible();
    expect(
      screen.getAllByText('Checking the page structure before choosing an action.'),
    ).toHaveLength(2);

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
});
