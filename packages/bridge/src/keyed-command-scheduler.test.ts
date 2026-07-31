import assert from 'node:assert/strict';
import test from 'node:test';
import { KeyedCommandScheduler } from './keyed-command-scheduler.js';

function scheduler(active: Set<string>) {
  return new KeyedCommandScheduler<string, string>({
    inactiveOwnerError: () => new Error('owner disconnected'),
    isOwnerActive: owner => active.has(owner),
  });
}

test('serializes one key while allowing another key to progress', async () => {
  const active = new Set(['first', 'second', 'other']);
  const commands = scheduler(active);
  const releaseFirst = await commands.acquire('target-1', 'first');
  let secondAcquired = false;
  const second = commands.acquire('target-1', 'second').then(release => {
    secondAcquired = true;
    return release;
  });
  const releaseOther = await commands.acquire('target-2', 'other');

  assert.equal(secondAcquired, false);
  releaseOther();
  releaseFirst();
  const releaseSecond = await second;
  assert.equal(secondAcquired, true);
  releaseSecond();
  releaseSecond();
});

test('skips inactive waiters and rejects explicitly cancelled waiters', async () => {
  const active = new Set(['first', 'inactive', 'cancelled', 'last']);
  const commands = scheduler(active);
  const releaseFirst = await commands.acquire('target', 'first');
  const inactive = commands.acquire('target', 'inactive');
  const cancelled = commands.acquire('target', 'cancelled');
  const last = commands.acquire('target', 'last');

  active.delete('inactive');
  commands.cancel('cancelled', new Error('cancelled by participant cleanup'));
  await assert.rejects(cancelled, /cancelled by participant cleanup/);
  releaseFirst();
  await assert.rejects(inactive, /owner disconnected/);
  const releaseLast = await last;
  releaseLast();
});

test('runs operations under a lease and clears every queued waiter', async () => {
  const active = new Set(['owner', 'queued']);
  const commands = scheduler(active);
  const release = await commands.acquire('target', 'owner');
  const queued = commands.acquire('target', 'queued');
  commands.clear(new Error('lease released'));

  await assert.rejects(queued, /lease released/);
  release();
  await assert.rejects(
    commands.run('target', 'missing', async () => 'unreachable'),
    /owner disconnected/,
  );
});
