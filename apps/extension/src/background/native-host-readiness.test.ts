import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeHostDisconnectState } from './native-host-readiness.js';

test('recognizes Chrome missing-host diagnostics', () => {
  assert.equal(nativeHostDisconnectState('Specified native messaging host not found.'), 'missing');
  assert.equal(
    nativeHostDisconnectState('Native messaging host org.panerelay.bridge not found'),
    'missing',
  );
});

test('keeps transient disconnects distinct from installation failures', () => {
  assert.equal(nativeHostDisconnectState('Native host has exited.'), 'disconnected');
  assert.equal(nativeHostDisconnectState('Panerelay Bridge disconnected'), 'disconnected');
});
