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
  const draft = await service.get('codex');

  const result = await service.send('codex', draft.revision, 'Hello');

  assert.equal(result.conversation?.conversation.id, 'thread-new');
  assert.equal(result.workspace.kind, 'conversation');
  assert.deepEqual(
    calls.map(request => request.method),
    ['conversation.start', 'conversation.send'],
  );
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
