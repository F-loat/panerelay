import assert from 'node:assert/strict';
import test from 'node:test';
import type { HostToExtensionMessage } from '@panerelay/protocol';
import { ControlActivityJournal } from './control-activity-journal.js';

function createJournal(maxRecords = 100) {
  const messages: HostToExtensionMessage[] = [];
  let id = 0;
  let now = Date.UTC(2026, 6, 31, 0, 0, 0);
  const journal = new ControlActivityJournal<string>({
    createId: () => `id-${++id}`,
    emit: message => messages.push(message),
    maxRecords,
    now: () => now++,
  });
  return { journal, messages };
}

const actor = { kind: 'automation' as const, name: 'agent-browser', sessionLabel: 'fixture' };

test('correlates sanitized activity without retaining method parameters', () => {
  const { journal, messages } = createJournal();
  journal.begin('client', 7, {
    actor,
    method: 'Runtime.evaluate',
    sessionId: 'lease-1',
    targetId: 'target-1',
  });
  journal.finish('client', 7, 'completed');
  journal.finish('client', 7, 'failed', 'transport-error');

  const updates = messages.filter(message => message.type === 'control.activity.updated');
  assert.equal(updates.length, 2);
  assert.equal(updates[0]?.activity.status, 'started');
  assert.equal(updates[1]?.activity.status, 'completed');
  assert.equal(updates[1]?.activity.category, 'page-content');
  assert.equal('method' in (updates[1]?.activity ?? {}), false);
  assert.equal('params' in (updates[1]?.activity ?? {}), false);
});

test('fails client and outstanding activities independently', () => {
  const { journal, messages } = createJournal();
  journal.begin('first', 1, { actor, method: 'Page.navigate', sessionId: 'lease-1' });
  journal.begin('second', 2, { actor, method: 'Input.dispatchKeyEvent', sessionId: 'lease-1' });
  journal.failClient('first', 'transport-error');
  journal.failOutstanding('session-ended');

  const terminal = messages
    .filter(message => message.type === 'control.activity.updated')
    .map(message => message.activity)
    .filter(activity => activity.status === 'failed');
  assert.deepEqual(
    terminal.map(activity => activity.failure),
    ['transport-error', 'session-ended'],
  );
});

test('bounds retained history and replays session state before the snapshot', () => {
  const { journal, messages } = createJournal(2);
  journal.emitSession({
    active: false,
    actor,
    connected: true,
    controlledTargetCount: 0,
    heartbeatTimeoutMs: 35_000,
    id: 'lease-1',
    lastHeartbeatAt: Date.UTC(2026, 6, 31, 0, 0, 0),
    observedTargetCount: 1,
    participantCount: 2,
  });
  for (let index = 0; index < 3; index += 1) {
    journal.begin('client', index, {
      actor,
      method: 'Runtime.evaluate',
      sessionId: 'lease-1',
    });
    journal.finish('client', index, 'completed');
  }
  journal.emitSnapshot();

  const replay = messages.slice(-2);
  assert.equal(replay[0]?.type, 'control.session.changed');
  assert.equal(replay[1]?.type, 'control.activity.snapshot');
  if (replay[1]?.type !== 'control.activity.snapshot') assert.fail('Expected activity snapshot');
  assert.equal(replay[1].activities.length, 2);
  assert.ok(replay[1].firstRetainedSequence);
  assert.equal(replay[0].session.heartbeatFreshness, 'fresh');
});
