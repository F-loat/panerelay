import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hostReleaseAfterDisconnect,
  hostReleaseAfterRegistration,
  nativeHostBridgeReady,
  nativeHostDisconnectPreservesAuthorization,
  nativeHostDisconnectState,
} from './native-host-readiness.js';

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

test('requires transport and completed registration, independently of maintenance state', () => {
  assert.equal(nativeHostBridgeReady('connected', true), true);
  assert.equal(nativeHostBridgeReady('connected', false), false);
  assert.equal(nativeHostBridgeReady('disconnected', true), false);
});

test('preserves restart progress across disconnect but resets other release states', () => {
  const restarting = {
    state: 'restart-pending' as const,
    hostVersion: '0.7.0',
    targetVersion: '0.8.0',
    retryAvailable: false,
  };
  assert.deepEqual(hostReleaseAfterDisconnect(restarting), restarting);
  assert.equal(nativeHostDisconnectPreservesAuthorization(restarting), true);
  assert.equal(
    nativeHostDisconnectPreservesAuthorization({ state: 'failed', retryAvailable: true }),
    false,
  );
  assert.deepEqual(hostReleaseAfterDisconnect({ state: 'failed', retryAvailable: true }), {
    state: 'checking',
    retryAvailable: false,
  });
});

test('moves restart-pending reconnects to ready for any valid registered Host release', () => {
  const restarting = hostReleaseAfterDisconnect({
    state: 'restart-pending',
    hostVersion: '0.7.0',
    targetVersion: '0.8.0-beta.42',
    retryAvailable: false,
  });
  assert.equal(restarting.state, 'restart-pending');
  assert.deepEqual(hostReleaseAfterRegistration('0.8.0-beta.42', '0.8.0-beta.42'), {
    state: 'ready',
    hostVersion: '0.8.0-beta.42',
    targetVersion: '0.8.0-beta.42',
    retryAvailable: false,
  });
  assert.deepEqual(hostReleaseAfterRegistration('0.8.0-beta.41', '0.8.0-beta.42'), {
    state: 'ready',
    hostVersion: '0.8.0-beta.41',
    targetVersion: '0.8.0-beta.42',
    retryAvailable: false,
  });
});
