import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_PROTOCOL_VERSION,
  type AutomationActivity,
  type ControlSessionSummary,
} from '@panerelay/protocol';
import {
  MAX_VISIBLE_AUTOMATION_ACTIVITIES,
  createControlActivityState,
  reduceControlActivity,
} from './control-activity-state.js';

const session: ControlSessionSummary = {
  id: 'session-1',
  actor: { kind: 'automation', name: 'agent-browser' },
  state: 'active',
  participantCount: 1,
  observedTargetCount: 0,
  controlledTargetCount: 1,
  heartbeatFreshness: 'fresh',
  updatedAt: '2026-07-29T12:00:00.000Z',
};

function activity(id: string, sequence: number): AutomationActivity {
  return {
    id,
    sessionId: session.id,
    actor: session.actor,
    category: 'interaction',
    label: 'interact-with-page',
    status: 'completed',
    sequence,
    startedAt: '2026-07-29T12:00:00.000Z',
    updatedAt: '2026-07-29T12:00:01.000Z',
  };
}

test('accepts the first observed sequence without inventing a history gap', () => {
  const state = reduceControlActivity(createControlActivityState(), {
    type: 'control.session.changed',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: 8,
    session,
  });
  assert.equal(state.sequence, 8);
  assert.equal(state.historyGap, false);
  assert.deepEqual(state.session, session);
});

test('detects skipped sequences and Bridge epoch changes', () => {
  const first = reduceControlActivity(createControlActivityState(), {
    type: 'control.session.changed',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: 1,
    session,
  });
  const skipped = reduceControlActivity(first, {
    type: 'control.activity.updated',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: 3,
    activity: activity('activity-1', 3),
  });
  assert.equal(skipped.historyGap, true);

  const restarted = reduceControlActivity(skipped, {
    type: 'control.activity.updated',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-2',
    sequence: 1,
    activity: activity('activity-2', 1),
  });
  assert.equal(restarted.historyGap, true);
  assert.equal(restarted.epoch, 'epoch-2');
  assert.equal(restarted.session, null);
  assert.deepEqual(
    restarted.activities.map(item => item.id),
    ['activity-2'],
  );
});

test('uses reconnect snapshots without flagging a range they cover', () => {
  const observed = reduceControlActivity(createControlActivityState(), {
    type: 'control.session.changed',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: 10,
    session,
  });
  const replayed = reduceControlActivity(observed, {
    type: 'control.activity.snapshot',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: 14,
    firstRetainedSequence: 11,
    activities: [activity('activity-1', 14)],
  });
  assert.equal(replayed.historyGap, false);
  assert.equal(replayed.sequence, 14);
  assert.equal(replayed.activities.length, 1);
});

test('coalesces updates and keeps only the latest fifty activities in memory', () => {
  let state = createControlActivityState();
  for (let sequence = 1; sequence <= 55; sequence += 1) {
    state = reduceControlActivity(state, {
      type: 'control.activity.updated',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: 'epoch-1',
      sequence,
      activity: activity(`activity-${sequence}`, sequence),
    });
  }
  assert.equal(state.activities.length, MAX_VISIBLE_AUTOMATION_ACTIVITIES);
  assert.equal(state.activities[0]?.id, 'activity-6');

  state = reduceControlActivity(state, {
    type: 'control.activity.updated',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: 56,
    activity: { ...activity('activity-55', 56), status: 'failed' },
  });
  assert.equal(state.activities.length, MAX_VISIBLE_AUTOMATION_ACTIVITIES);
  assert.equal(state.activities.at(-1)?.id, 'activity-55');
  assert.equal(state.activities.at(-1)?.status, 'failed');
});

test('marks a reconnect snapshot whose retained range starts after the last observation', () => {
  const observed = reduceControlActivity(createControlActivityState(), {
    type: 'control.session.changed',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: 10,
    session,
  });
  const replayed = reduceControlActivity(observed, {
    type: 'control.activity.snapshot',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: 30,
    firstRetainedSequence: 20,
    activities: [activity('activity-1', 30)],
  });
  assert.equal(replayed.historyGap, true);
});
