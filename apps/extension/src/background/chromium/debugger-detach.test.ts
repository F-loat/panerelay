import assert from 'node:assert/strict';
import test from 'node:test';
import { debuggerDetachReason } from './debugger-detach.ts';

test('does not report a closed target as a debugger displacement', () => {
  assert.equal(debuggerDetachReason('target_closed'), null);
});

test('reports user or DevTools displacement to the relay client', () => {
  assert.equal(
    debuggerDetachReason('canceled_by_user'),
    'Chrome debugger detached: canceled_by_user',
  );
});
