import assert from 'node:assert/strict';
import test from 'node:test';
import { createHostUpdateCheck } from './host-update-check.js';

test('requests a Host update check only once per Extension background lifetime', () => {
  const consumeHostUpdateCheck = createHostUpdateCheck();

  assert.equal(consumeHostUpdateCheck(), true);
  assert.equal(consumeHostUpdateCheck(), false);
  assert.equal(consumeHostUpdateCheck(), false);
});

test('a new Extension background lifetime receives a new one-shot check', () => {
  assert.equal(createHostUpdateCheck()(), true);
  assert.equal(createHostUpdateCheck()(), true);
});
