import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentRequest, ConversationDetail } from '@panerelay/protocol';
import { ConversationWorkspaceService } from './conversation-workspace-service.js';
import {
  ConversationWorkspaceStore,
  WorkspaceRevisionConflictError,
} from './conversation-workspaces.js';

function detail(id: string, providerId = 'codex'): ConversationDetail {
  const now = '2026-07-30T00:00:00.000Z';
  return {
    conversation: {
      id,
      providerId,
      title: id,
      preview: '',
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    },
    messages: [],
  };
}

function harness() {
  let activeTabId = 11;
  let nextId = 0;
  const calls: AgentRequest[] = [];
  const changes: Array<{ tabId: number; revision: string }> = [];
  const store = new ConversationWorkspaceStore({ createId: () => `id-${++nextId}` });
  let responder: (request: AgentRequest) => Promise<unknown> = async request => {
    calls.push(request);
    if (request.method === 'conversation.start') return detail('thread-new', request.providerId);
    if (request.method === 'conversation.resume') {
      return detail(request.conversationId, request.providerId);
    }
    if (request.method === 'conversation.send') return { turnId: 'turn-1' };
    return {};
  };
  const service = new ConversationWorkspaceService({
    activeTabId: async () => activeTabId,
    activeTabContext: async tabId => ({
      url: `https://example.com/tab-${tabId}?token=secret`,
      title: `Tab ${tabId}`,
    }),
    onChanged(tabId, workspace) {
      changes.push({ tabId, revision: workspace.revision });
    },
    requestAgent: request => responder(request),
    store,
  });
  return {
    calls,
    changes,
    service,
    setActiveTabId(value: number) {
      activeTabId = value;
    },
    setResponder(value: typeof responder) {
      responder = value;
    },
    store,
  };
}

test('creates, binds, and sends exactly once for a draft first message', async () => {
  const { calls, service } = harness();
  const initialDraft = await service.get('codex');
  const draft = await service.setDirectory(initialDraft.revision, '/workspace/project');

  const result = await service.send('codex', draft.revision, 'Hello');

  assert.equal(result.conversation?.conversation.id, 'thread-new');
  assert.equal(result.workspace.kind, 'conversation');
  assert.deepEqual(
    calls.map(request => request.method),
    ['conversation.start', 'conversation.send'],
  );
  assert.deepEqual(calls[0], {
    method: 'conversation.start',
    providerId: 'codex',
    options: {
      cwd: '/workspace/project',
      initialPage: {
        url: 'https://example.com/tab-11?token=secret',
        title: 'Tab 11',
      },
    },
  });
  assert.equal(result.workspace.cwd, '/workspace/project');
});

test('clears a draft project without creating a conversation', async () => {
  const { calls, service } = harness();
  const draft = await service.get('codex');
  const selected = await service.setDirectory(draft.revision, '/workspace/project');
  const cleared = await service.setDirectory(selected.revision);

  assert.equal(cleared.cwd, undefined);
  assert.deepEqual(calls, []);
});

test('starts fresh only in the active related tab and preserves the sibling conversation', async () => {
  const { service, store } = harness();
  const draft = await service.get('codex');
  await store.inherit(11, 22);
  const bound = await store.bindConversation(11, draft.revision, 'codex', 'thread-shared');

  const detached = await service.reset('qoder', bound.revision);
  assert.deepEqual(detached, {
    kind: 'draft',
    providerId: 'qoder',
    revision: 'id-5',
  });
  assert.deepEqual(await store.get(22), bound);

  const sent = await service.send('qoder', detached.revision, 'Start separately');
  assert.equal(sent.workspace.kind, 'conversation');
  assert.equal(
    sent.workspace.kind === 'conversation' ? sent.workspace.conversationId : '',
    'thread-new',
  );
  assert.deepEqual(await store.get(22), bound);
});

test('sends an existing conversation only when the rendered revision still owns the tab', async () => {
  const { calls, service, store } = harness();
  const draft = await service.get('codex');
  const bound = await store.bindConversation(11, draft.revision, 'codex', 'thread-1');

  await service.send('codex', bound.revision, 'Continue', 'thread-1');
  await assert.rejects(
    service.send('codex', draft.revision, 'Stale', 'thread-1'),
    WorkspaceRevisionConflictError,
  );
  assert.deepEqual(
    calls.map(request => request.method),
    ['conversation.send'],
  );
});

test('forwards images through both draft and bound conversation sends', async () => {
  const { calls, service, store } = harness();
  const draft = await service.get('codex');
  const images = [{ data: 'AQID', mimeType: 'image/png', name: 'screenshot.png' }];

  await service.send('codex', draft.revision, '', undefined, images);
  assert.deepEqual(calls[1], {
    method: 'conversation.send',
    providerId: 'codex',
    conversationId: 'thread-new',
    text: '',
    images,
  });

  const nextDraft = await service.reset('codex', (await store.get(11))!.revision);
  const bound = await store.bindConversation(11, nextDraft.revision, 'codex', 'thread-bound');
  await service.send('codex', bound.revision, '', 'thread-bound', images);
  assert.deepEqual(calls.at(-1), {
    method: 'conversation.send',
    providerId: 'codex',
    conversationId: 'thread-bound',
    text: '',
    images,
  });
});

test('commits a delayed resume to its captured tab instead of the newly active tab', async () => {
  const { service, setActiveTabId, setResponder, store } = harness();
  const tabOne = await service.get('codex');
  let resolveResume!: (value: ConversationDetail) => void;
  setResponder(
    () =>
      new Promise(resolve => {
        resolveResume = resolve;
      }),
  );

  const pending = service.resume('codex', 'thread-1', tabOne.revision);
  await new Promise<void>(resolve => setImmediate(resolve));
  setActiveTabId(22);
  await service.get('qoder');
  resolveResume(detail('thread-1'));
  await pending;

  assert.equal((await store.get(11))?.kind, 'conversation');
  assert.deepEqual(await store.get(22), {
    kind: 'draft',
    providerId: 'qoder',
    revision: 'id-5',
  });
});

test('rolls back a reservation after resume failure and rejects an older revision', async () => {
  const { service, setResponder } = harness();
  const draft = await service.get('codex');
  setResponder(async () => {
    throw new Error('resume failed');
  });

  await assert.rejects(service.resume('codex', 'thread-1', draft.revision), /resume failed/);
  const restored = await service.get('codex');
  assert.equal(restored.kind, 'draft');
  assert.notEqual(restored.revision, draft.revision);
  await assert.rejects(service.reset('qoder', draft.revision), WorkspaceRevisionConflictError);
});

test('rolls a failed first send back to a retryable draft with its project', async () => {
  const { calls, service, setResponder, store } = harness();
  const initial = await service.get('codex');
  const draft = await service.setDirectory(initial.revision, '/workspace/project');
  setResponder(async request => {
    calls.push(request);
    if (request.method === 'conversation.start') return detail('thread-failed', request.providerId);
    if (request.method === 'conversation.send') throw new Error('send failed');
    return {};
  });

  await assert.rejects(service.send('codex', draft.revision, 'Retry me'), /send failed/);

  const restored = await store.get(11);
  assert.deepEqual(restored, {
    kind: 'draft',
    providerId: 'codex',
    cwd: '/workspace/project',
    revision: 'id-5',
  });
  assert.deepEqual(
    calls.map(request => request.method),
    ['conversation.start', 'conversation.send'],
  );
  await assert.rejects(
    service.send('codex', draft.revision, 'Stale retry'),
    WorkspaceRevisionConflictError,
  );
});
