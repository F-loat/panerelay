import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConversationSummary } from '@panerelay/protocol';
import {
  MAX_TIMELINE_DETAIL_CHARS,
  MAX_TIMELINE_ITEMS,
  MAX_TIMELINE_TEXT_CHARS,
  createConversationTimelineSnapshot,
  parseConversationTimelineSnapshot,
  sanitizeConversationEvent,
  sanitizeTimeline,
  type TimelineItem,
} from './conversation-timeline.js';

const conversation: ConversationSummary = {
  id: 'conversation-1',
  providerId: 'qoder',
  model: 'auto',
  title: 'Timeline test',
  preview: '',
  status: 'idle',
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:01.000Z',
};

test('creates a bounded semantic snapshot without approvals or unknown fields', () => {
  const timeline: TimelineItem[] = [
    {
      type: 'message',
      segmentId: 'message-segment-1',
      streaming: true,
      message: {
        id: 'message-1',
        role: 'assistant',
        text: 'x'.repeat(MAX_TIMELINE_TEXT_CHARS + 10),
        phase: 'final',
        createdAt: conversation.updatedAt,
      },
    },
    { type: 'reasoning', id: 'reasoning-1', text: 'checking' },
    {
      type: 'activity',
      activity: {
        id: 'tool-1',
        kind: 'tool',
        title: 'Inspect page',
        output: 'visible output',
        detail: 'd'.repeat(MAX_TIMELINE_DETAIL_CHARS + 10),
        status: 'completed',
      },
    },
    {
      type: 'approval',
      approval: {
        id: 'approval-1',
        conversationId: conversation.id,
        turnId: 'turn-1',
        kind: 'tool',
        title: 'Allow tool?',
        command: 'secret command',
        cwd: '/secret/path',
        decisions: ['accept', 'cancel'],
      },
    },
  ];

  const snapshot = createConversationTimelineSnapshot({
    providerId: 'qoder',
    conversation,
    timeline,
    runningTurnId: null,
    throughSequence: 4,
    capturedAt: conversation.updatedAt,
  });

  assert.ok(snapshot);
  assert.equal(snapshot.timeline.length, 3);
  assert.equal(
    snapshot.timeline.some(item => item.type === 'approval'),
    false,
  );
  assert.equal(
    snapshot.timeline[0]?.type === 'message' ? snapshot.timeline[0].message.text.length : 0,
    MAX_TIMELINE_TEXT_CHARS,
  );
  assert.equal(
    snapshot.timeline[0]?.type === 'message' ? snapshot.timeline[0].streaming : undefined,
    undefined,
  );
  assert.equal(
    snapshot.timeline[0]?.type === 'message' ? snapshot.timeline[0].segmentId : undefined,
    'message-segment-1',
  );
  assert.equal(
    snapshot.timeline[2]?.type === 'activity' ? snapshot.timeline[2].activity.output : '',
    'visible output',
  );
  assert.equal(
    snapshot.timeline[2]?.type === 'activity' ? snapshot.timeline[2].activity.detail?.length : 0,
    MAX_TIMELINE_DETAIL_CHARS,
  );
  assert.equal(JSON.stringify(snapshot).includes('secret command'), false);
  assert.equal(JSON.stringify(snapshot).includes('/secret/path'), false);
});

test('rejects unknown, mismatched, and malformed snapshot records', () => {
  const snapshot = createConversationTimelineSnapshot({
    providerId: 'qoder',
    conversation,
    timeline: [],
    runningTurnId: null,
    throughSequence: 0,
    capturedAt: conversation.updatedAt,
  });
  assert.ok(snapshot);
  assert.equal(parseConversationTimelineSnapshot({ ...snapshot, version: 99 }), null);
  assert.equal(
    parseConversationTimelineSnapshot(snapshot, {
      providerId: 'codex',
      conversationId: conversation.id,
    }),
    null,
  );
  assert.equal(parseConversationTimelineSnapshot({ ...snapshot, throughSequence: -1 }), null);
});

test('keeps the newest bounded timeline items', () => {
  const timeline = Array.from({ length: MAX_TIMELINE_ITEMS + 5 }, (_, index) => ({
    type: 'reasoning' as const,
    id: `reasoning-${index}`,
    text: `${index}`,
  }));
  const retained = sanitizeTimeline(timeline);
  assert.equal(retained.length, MAX_TIMELINE_ITEMS);
  assert.equal(retained[0]?.type === 'reasoning' ? retained[0].id : '', 'reasoning-5');
});

test('retains only replayable visible events and excludes approvals and usage', () => {
  const activity = sanitizeConversationEvent({
    kind: 'activity.updated',
    conversationId: conversation.id,
    turnId: 'turn-1',
    activity: {
      id: 'tool-1',
      kind: 'tool',
      title: 'Tool',
      status: 'completed',
      output: 'visible',
      rawInput: { password: 'not retained' },
    },
    providerMetadata: { token: 'not retained' },
  });
  assert.deepEqual(activity, {
    kind: 'activity.updated',
    conversationId: conversation.id,
    turnId: 'turn-1',
    activity: {
      id: 'tool-1',
      kind: 'tool',
      title: 'Tool',
      output: 'visible',
      status: 'completed',
    },
  });
  assert.equal(
    sanitizeConversationEvent({
      kind: 'approval.requested',
      conversationId: conversation.id,
      turnId: 'turn-1',
      approval: { id: 'approval-1' },
    }),
    null,
  );
  assert.equal(
    sanitizeConversationEvent({
      kind: 'usage.updated',
      conversationId: conversation.id,
      turnId: 'turn-1',
      totalTokens: 10,
    }),
    null,
  );
});
