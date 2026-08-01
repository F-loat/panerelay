import assert from 'node:assert/strict';
import test from 'node:test';
import { PendingRequestTracker } from './pending-request-tracker.js';

function deferredTimers() {
  let nextTimer = 0;
  const callbacks = new Map<number, () => void>();
  return {
    cancelTimer(timer: ReturnType<typeof setTimeout>) {
      callbacks.delete(timer as unknown as number);
    },
    fire(timer: number) {
      callbacks.get(timer)?.();
    },
    scheduleTimer(callback: () => void) {
      nextTimer += 1;
      callbacks.set(nextTimer, callback);
      return nextTimer as unknown as ReturnType<typeof setTimeout>;
    },
  };
}

test('settles successful and failed correlated requests exactly once', async () => {
  const timers = deferredTimers();
  let nextId = 0;
  const tracker = new PendingRequestTracker<string>(1_000, {
    ...timers,
    createRequestId: () => `request-${++nextId}`,
  });
  let successId = '';
  const success = tracker.request('success', requestId => {
    successId = requestId;
  });

  assert.equal(tracker.pendingCount, 1);
  assert.equal(tracker.resolve(successId, 'done'), true);
  assert.equal(tracker.resolve(successId, 'late'), false);
  assert.equal(await success, 'done');

  let failureId = '';
  const failure = tracker.request('failure', requestId => {
    failureId = requestId;
  });
  assert.equal(tracker.reject(failureId, new Error('failed')), true);
  await assert.rejects(failure, /failed/);
  assert.equal(tracker.reject('unknown', new Error('ignored')), false);
  assert.equal(tracker.pendingCount, 0);
});

test('cleans up synchronous dispatch failures and deterministic timeouts', async () => {
  const timers = deferredTimers();
  let nextId = 0;
  const tracker = new PendingRequestTracker<string>(1_000, {
    ...timers,
    createRequestId: () => `request-${++nextId}`,
  });
  const dispatchError = new Error('transport unavailable');
  const failedDispatch = tracker.request('dispatch', () => {
    throw dispatchError;
  });

  await assert.rejects(failedDispatch, dispatchError);
  assert.equal(tracker.pendingCount, 0);

  const timedOut = tracker.request('conversation.send', () => undefined);
  assert.equal(tracker.pendingCount, 1);
  timers.fire(2);
  await assert.rejects(timedOut, /Timed out waiting for conversation\.send/);
  assert.equal(tracker.pendingCount, 0);
});

test('rejects every pending request during disconnect cleanup', async () => {
  const timers = deferredTimers();
  let nextId = 0;
  const tracker = new PendingRequestTracker<string>(1_000, {
    ...timers,
    createRequestId: () => `request-${++nextId}`,
  });
  const first = tracker.request('first', () => undefined);
  const second = tracker.request('second', () => undefined);

  tracker.rejectAll('Bridge disconnected');

  await assert.rejects(first, /Bridge disconnected/);
  await assert.rejects(second, /Bridge disconnected/);
  assert.equal(tracker.pendingCount, 0);
});

test('invokes default host timers with their required global receiver', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timer = { id: 1 } as unknown as ReturnType<typeof setTimeout>;
  let cancelled = false;

  globalThis.setTimeout = function (this: unknown) {
    assert.equal(this, globalThis);
    return timer;
  } as typeof setTimeout;
  globalThis.clearTimeout = function (this: unknown, received) {
    assert.equal(this, globalThis);
    assert.equal(received, timer);
    cancelled = true;
  } as typeof clearTimeout;

  try {
    const tracker = new PendingRequestTracker<string>(1_000, {
      createRequestId: () => 'browser-request',
    });
    let requestId = '';
    const result = tracker.request('agent.providers', id => {
      requestId = id;
    });

    assert.equal(tracker.resolve(requestId, 'ready'), true);
    assert.equal(await result, 'ready');
    assert.equal(cancelled, true);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
