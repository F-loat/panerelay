import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ConversationWorkspaceStore,
  WorkspaceRevisionConflictError,
} from './conversation-workspaces.js';

function harness() {
  let nextId = 0;
  let stored: Record<string, unknown> = {};
  const store = new ConversationWorkspaceStore({
    createId: () => `id-${++nextId}`,
    storage: {
      async get() {
        return { ...stored };
      },
      async set(items) {
        stored = { ...stored, ...items };
      },
    },
  });
  return { store };
}

test('creates a draft and replaces every related tab with one conversation', async () => {
  const { store } = harness();
  const draft = await store.getOrCreate(11, 'codex');
  assert.deepEqual(draft, { kind: 'draft', providerId: 'codex', revision: 'id-2' });
  assert.deepEqual(await store.inherit(11, 22), draft);

  const conversation = await store.bindConversation(22, draft.revision, 'codex', 'thread-1');
  assert.deepEqual(conversation, {
    kind: 'conversation',
    providerId: 'codex',
    revision: 'id-3',
    conversationId: 'thread-1',
  });
  assert.deepEqual(await store.get(11), conversation);
  assert.deepEqual(await store.get(22), conversation);
});

test('updates, inherits, detaches, and clears draft project directories by revision', async () => {
  const { store } = harness();
  const draft = await store.getOrCreate(11, 'codex');
  const selected = await store.setDirectory(11, draft.revision, '/workspace/project');
  assert.equal(selected.cwd, '/workspace/project');
  assert.deepEqual(await store.inherit(11, 22), selected);

  const bound = await store.bindConversation(22, selected.revision, 'codex', 'thread-1');
  assert.equal(bound.cwd, '/workspace/project');
  await assert.rejects(
    store.setDirectory(11, bound.revision, '/workspace/other'),
    /only change before a conversation starts/,
  );

  const reset = await store.reset(11, bound.revision, 'qoder');
  assert.equal(reset.cwd, '/workspace/project');
  assert.equal(reset.kind, 'draft');
  assert.equal(reset.providerId, 'qoder');
  const sibling = await store.get(22);
  assert.deepEqual(sibling, bound);

  const cleared = await store.setDirectory(11, reset.revision);
  assert.equal(cleared.cwd, undefined);
  assert.equal((await store.get(11))?.cwd, undefined);
  assert.equal((await store.get(22))?.cwd, '/workspace/project');

  const detachedConversation = await store.bindConversation(
    11,
    cleared.revision,
    'qoder',
    'thread-2',
  );
  assert.equal(
    detachedConversation.kind === 'conversation' ? detachedConversation.conversationId : '',
    'thread-2',
  );
  assert.deepEqual(await store.get(22), bound);
});

test('leaves unrelated and conflicting target tabs isolated', async () => {
  const { store } = harness();
  await store.getOrCreate(11, 'codex');
  const qoder = await store.getOrCreate(33, 'qoder');

  assert.deepEqual(await store.inherit(11, 44), await store.get(11));
  assert.equal(await store.inherit(11, 33), null);
  assert.deepEqual(await store.get(33), qoder);
  assert.equal(await store.inherit(55, 66), null);
});

test('rejects stale revisions and preserves the newer workspace', async () => {
  const { store } = harness();
  const first = await store.getOrCreate(11, 'codex');
  const newer = await store.reset(11, first.revision, 'qoder');

  await assert.rejects(
    store.bindConversation(11, first.revision, 'codex', 'thread-stale'),
    WorkspaceRevisionConflictError,
  );
  assert.deepEqual(await store.get(11), newer);
});

test('joins only the active tab to the deterministic existing conversation group', async () => {
  const { store } = harness();
  const active = await store.getOrCreate(11, 'codex');
  await store.inherit(11, 12);

  let low = await store.getOrCreate(20, 'qoder');
  low = await store.setDirectory(20, low.revision, '/workspace/low');
  low = await store.bindConversation(20, low.revision, 'qoder', 'thread-selected');

  let high = await store.getOrCreate(22, 'qoder');
  high = await store.setDirectory(22, high.revision, '/workspace/high');
  high = await store.bindConversation(22, high.revision, 'qoder', 'thread-selected');

  const joined = await store.joinConversation(11, active.revision, 'qoder', 'thread-selected');
  assert.deepEqual(joined, low);
  assert.deepEqual(await store.get(12), active);
  assert.deepEqual(await store.get(20), low);
  assert.deepEqual(await store.get(22), high);

  const reservation = await store.reserve(11, joined.revision);
  assert.equal((await store.get(20))?.revision, reservation.revision);
  assert.deepEqual(await store.get(22), high);
});

test('creates a new conversation group only when no live matching group remains', async () => {
  const { store } = harness();
  const draft = await store.getOrCreate(11, 'codex');
  await store.inherit(11, 12);

  const joined = await store.joinConversation(11, draft.revision, 'qoder', 'thread-retained');
  assert.deepEqual(joined, {
    kind: 'conversation',
    providerId: 'qoder',
    revision: 'id-4',
    conversationId: 'thread-retained',
  });
  assert.deepEqual(await store.get(12), draft);
  assert.deepEqual(
    await store.joinConversation(11, joined.revision, 'qoder', 'thread-retained'),
    joined,
  );
  await assert.rejects(
    store.joinConversation(11, draft.revision, 'qoder', 'thread-stale'),
    WorkspaceRevisionConflictError,
  );
});

test('reserves, commits, and rolls back serialized provider work', async () => {
  const { store } = harness();
  const draft = await store.getOrCreate(11, 'codex');
  await store.inherit(11, 22);
  const reservation = await store.reserve(11, draft.revision);

  await assert.rejects(store.reset(22, draft.revision, 'qoder'), WorkspaceRevisionConflictError);
  const committed = await store.commit(reservation, {
    kind: 'conversation',
    providerId: 'codex',
    conversationId: 'thread-1',
  });
  assert.deepEqual(await store.get(22), committed);

  const secondReservation = await store.reserve(22, committed.revision);
  const rolledBack = await store.rollback(secondReservation);
  assert.equal(rolledBack.kind, 'conversation');
  assert.equal(rolledBack.providerId, 'codex');
  assert.equal(rolledBack.kind === 'conversation' ? rolledBack.conversationId : '', 'thread-1');
});

test('keeps a group until its last related tab closes', async () => {
  const { store } = harness();
  await store.getOrCreate(11, 'codex');
  await store.inherit(11, 22);

  const firstRemoval = await store.remove(11);
  assert.equal(firstRemoval?.remainingTabCount, 1);
  assert.ok(await store.get(22));

  const lastRemoval = await store.remove(22);
  assert.equal(lastRemoval?.remainingTabCount, 0);
  assert.equal(await store.get(22), null);
});
