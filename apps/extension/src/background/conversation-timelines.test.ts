import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConversationSummary } from '@panerelay/protocol';
import {
  createConversationTimelineSnapshot,
  type ConversationTimelineSnapshot,
} from '../shared/conversation-timeline.js';
import { ConversationTimelineStore } from './conversation-timelines.js';

function summary(id: string, providerId = 'qoder'): ConversationSummary {
  return {
    id,
    providerId,
    title: id,
    preview: '',
    status: 'running',
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:01.000Z',
  };
}

function snapshot(
  id = 'conversation-1',
  throughSequence = 0,
  providerId = 'qoder',
): ConversationTimelineSnapshot {
  const value = createConversationTimelineSnapshot({
    providerId,
    conversation: summary(id, providerId),
    timeline: [
      {
        type: 'message',
        message: {
          id: `${id}-user`,
          role: 'user',
          text: 'Inspect this page',
          createdAt: '2026-08-05T00:00:01.000Z',
        },
      },
    ],
    runningTurnId: 'turn-1',
    throughSequence,
    capturedAt: '2026-08-05T00:00:02.000Z',
  });
  assert.ok(value);
  return value;
}

function harness(
  options: {
    maxRecords?: number;
    maxRecordChars?: number;
    maxStoreChars?: number;
  } = {},
) {
  let stored: Record<string, unknown> = {};
  let clock = 0;
  const store = new ConversationTimelineStore({
    ...options,
    now: () => `2026-08-05T00:00:${String(clock++).padStart(2, '0')}.000Z`,
    storage: {
      async get() {
        return structuredClone(stored);
      },
      async set(items) {
        stored = { ...stored, ...structuredClone(items) };
      },
    },
  });
  return {
    store,
    replaceStored(value: Record<string, unknown>) {
      stored = structuredClone(value);
    },
    readStored() {
      return structuredClone(stored);
    },
  };
}

test('retains normalized events when no Side Panel is mounted', async () => {
  const { store } = harness();
  await store.save(snapshot());

  assert.equal(
    await store.append({
      kind: 'reasoning.delta',
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      itemId: 'reasoning-1',
      delta: 'Checking the page',
    }),
    1,
  );
  assert.equal(
    await store.append({
      kind: 'activity.updated',
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      activity: {
        id: 'tool-1',
        kind: 'tool',
        title: 'Read page',
        status: 'completed',
      },
    }),
    2,
  );

  const replay = await store.load('qoder', 'conversation-1');
  assert.equal(replay.snapshot?.timeline.length, 1);
  assert.deepEqual(
    replay.events.map(item => [item.sequence, item.event.kind]),
    [
      [1, 'reasoning.delta'],
      [2, 'activity.updated'],
    ],
  );
});

test('never persists approvals and ignores events without an existing snapshot', async () => {
  const { store } = harness();
  assert.equal(
    await store.append({
      kind: 'message.delta',
      conversationId: 'unknown-conversation',
      turnId: 'turn-1',
      messageId: 'message-1',
      delta: 'ignored',
    }),
    null,
  );
  await store.save(snapshot());
  assert.equal(
    await store.append({
      kind: 'approval.requested',
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      approval: {
        id: 'approval-1',
        conversationId: 'conversation-1',
        turnId: 'turn-1',
        kind: 'tool',
        title: 'Allow?',
        decisions: ['accept', 'cancel'],
      },
    }),
    null,
  );
  assert.deepEqual((await store.load('qoder', 'conversation-1')).events, []);
});

test('serializes save and append races and prunes only acknowledged events', async () => {
  const { store } = harness();
  await store.save(snapshot());
  await Promise.all([
    store.append({
      kind: 'message.delta',
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      messageId: 'assistant-1',
      delta: 'live',
    }),
    store.save(snapshot()),
  ]);
  assert.deepEqual(
    (await store.load('qoder', 'conversation-1')).events.map(item => item.sequence),
    [1],
  );

  const acknowledged = snapshot('conversation-1', 1);
  acknowledged.timeline.push({ type: 'reasoning', id: 'reasoning-1', text: 'saved' });
  await store.save(acknowledged);
  assert.deepEqual((await store.load('qoder', 'conversation-1')).events, []);
});

test('rejects an acknowledgement ahead of the stored sequence without pruning events', async () => {
  const { store } = harness();
  await store.save(snapshot());
  await store.append({
    kind: 'reasoning.delta',
    conversationId: 'conversation-1',
    turnId: 'turn-1',
    itemId: 'reasoning-1',
    delta: 'retained',
  });

  await assert.rejects(
    store.save(snapshot('conversation-1', 999)),
    /acknowledgement exceeds the stored event sequence/,
  );
  const replay = await store.load('qoder', 'conversation-1');
  assert.equal(replay.snapshot?.throughSequence, 0);
  assert.deepEqual(
    replay.events.map(item => item.sequence),
    [1],
  );
});

test('does not append an event when its conversation id is ambiguous across providers', async () => {
  const { store } = harness();
  await store.save(snapshot('shared-conversation', 0, 'qoder'));
  await store.save(snapshot('shared-conversation', 0, 'opencode'));

  assert.equal(
    await store.append({
      kind: 'message.delta',
      conversationId: 'shared-conversation',
      turnId: 'turn-1',
      messageId: 'assistant-1',
      delta: 'must not cross providers',
    }),
    null,
  );
  assert.deepEqual((await store.load('qoder', 'shared-conversation')).events, []);
  assert.deepEqual((await store.load('opencode', 'shared-conversation')).events, []);
});

test('ignores unknown store versions and malformed records', async () => {
  const { store, replaceStored } = harness();
  replaceStored({
    'panerelay.conversationTimelines.v1': {
      schema: 'panerelay.conversation-timeline-store',
      version: 99,
      records: { unsafe: { prompt: 'do not load' } },
    },
  });
  assert.deepEqual(await store.load('qoder', 'conversation-1'), { snapshot: null, events: [] });
});

test('compacts least-recent records and oversized oldest content', async () => {
  const { store, readStored } = harness({
    maxRecords: 2,
    maxRecordChars: 1_300,
    maxStoreChars: 2_400,
  });
  for (const id of ['conversation-1', 'conversation-2', 'conversation-3']) {
    const value = snapshot(id);
    value.timeline.push({ type: 'reasoning', id: `${id}-reasoning`, text: 'x'.repeat(1_000) });
    await store.save(value);
  }

  assert.equal((await store.load('qoder', 'conversation-1')).snapshot, null);
  assert.ok((await store.load('qoder', 'conversation-3')).snapshot);
  assert.ok(JSON.stringify(readStored()).length <= 2_400);
});
