import assert from 'node:assert/strict';
import test from 'node:test';
import type { CdpTargetInfo } from '@panerelay/protocol';
import {
  TargetExposureState,
  TargetPublicationQueue,
  targetInfoEquals,
} from './target-publication.js';

const target: CdpTargetInfo = {
  targetId: 'opaque-target',
  type: 'page',
  title: 'Fixture',
  url: 'https://example.test/',
  attached: true,
  active: false,
};

test('compares every observable target metadata field', () => {
  assert.equal(targetInfoEquals(target, { ...target }), true);
  for (const changed of [
    { title: 'Changed' },
    { url: 'https://other.test/' },
    { attached: false },
    { active: true },
  ]) {
    assert.equal(targetInfoEquals(target, { ...target, ...changed }), false);
  }
});

test('seeds target exposure once and expands only through explicit or controlled lineage', () => {
  const exposure = new TargetExposureState();
  exposure.seedEligible([1, 2]);
  exposure.seedEligible([1, 2, 3]);

  assert.equal(exposure.has(1), true);
  assert.equal(exposure.has(2), true);
  assert.equal(exposure.has(3), false);
  assert.equal(exposure.exposeRelated(1, 4, false), false);
  assert.equal(exposure.has(4), false);
  assert.equal(exposure.exposeRelated(1, 4, true), true);
  assert.equal(exposure.has(4), true);
  assert.equal(exposure.exposeRelated(3, 5, true), false);
  exposure.expose(6);
  assert.equal(exposure.has(6), true);

  exposure.remove(4);
  assert.equal(exposure.has(4), false);
  exposure.clear();
  exposure.seedEligible([3]);
  assert.equal(exposure.has(1), false);
  assert.equal(exposure.has(3), true);
});

test('serializes target publication per tab without blocking another tab', async () => {
  const queue = new TargetPublicationQueue();
  const order: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });

  const first = queue.enqueue(1, async () => {
    order.push('first-start');
    await firstGate;
    order.push('first-end');
  });
  const second = queue.enqueue(1, async () => {
    order.push('second');
  });
  const otherTab = queue.enqueue(2, async () => {
    order.push('other');
  });

  await otherTab;
  assert.deepEqual(order, ['first-start', 'other']);
  releaseFirst?.();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first-start', 'other', 'first-end', 'second']);
});
