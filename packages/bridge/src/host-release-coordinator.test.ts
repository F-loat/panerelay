import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isHostToExtensionMessage,
  type BrowserRegistration,
  type HostToExtensionMessage,
} from '@panerelay/protocol';
import { HostReleaseCoordinator } from './host-release-coordinator.js';
import { NativeHostUpdateFailure } from './host-updater.js';

const browser = (releaseVersion: string, checkHostUpdate = true): BrowserRegistration => ({
  browserId: 'browser-1',
  browserName: 'Chrome',
  extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
  releaseVersion,
  buildVersion: '0.8.0.0',
  checkHostUpdate,
});

function coordinatorWithUpdate(
  hostVersion: string,
  runUpdate: (targetVersion: string) => Promise<void>,
  messages: HostToExtensionMessage[] = [],
  requestRestart: () => void = () => {},
): HostReleaseCoordinator {
  return new HostReleaseCoordinator({
    hostVersion,
    requestRestart,
    runUpdate,
    sendToExtension: message => messages.push(message),
  });
}

test('does nothing when versions match or the Host is newer', async () => {
  for (const hostVersion of ['0.8.0-beta.42', '0.9.0']) {
    const messages: HostToExtensionMessage[] = [];
    let updates = 0;
    const coordinator = coordinatorWithUpdate(
      hostVersion,
      async () => {
        updates += 1;
      },
      messages,
    );

    await coordinator.evaluateRegistration(browser('0.8.0-beta.42'));
    assert.equal(coordinator.state, 'ready');
    assert.equal(updates, 0);
    assert.deepEqual(messages, []);
  }
});

test('does not update an older Host when the registration consumed its one-shot check', async () => {
  let updates = 0;
  const coordinator = coordinatorWithUpdate('0.7.0', async () => {
    updates += 1;
  });

  await coordinator.evaluateRegistration(browser('0.8.0', false));
  assert.equal(coordinator.state, 'ready');
  assert.equal(coordinator.targetVersion, null);
  assert.equal(updates, 0);
});

test('updates an older Host once and requests restart only after success', async () => {
  const messages: HostToExtensionMessage[] = [];
  const targets: string[] = [];
  let restarts = 0;
  const coordinator = coordinatorWithUpdate(
    '0.7.0',
    async target => {
      targets.push(target);
    },
    messages,
    () => {
      restarts += 1;
    },
  );

  await coordinator.evaluateRegistration(browser('0.8.0-beta.42'));
  await coordinator.evaluateRegistration(browser('0.8.0-beta.42'));

  assert.deepEqual(targets, ['0.8.0-beta.42']);
  assert.equal(restarts, 1);
  assert.equal(coordinator.state, 'restart-pending');
  assert.deepEqual(
    messages.map(message => (message.type === 'host.update.status' ? message.state : 'other')),
    ['restart-pending'],
  );
  assert.ok(messages.every(isHostToExtensionMessage));
});

test('quietly contains an unavailable exact package without requesting restart', async () => {
  const messages: HostToExtensionMessage[] = [];
  let restarts = 0;
  const coordinator = coordinatorWithUpdate(
    '0.7.0',
    async () => {
      throw new NativeHostUpdateFailure('package-unavailable', 'private npm output');
    },
    messages,
    () => {
      restarts += 1;
    },
  );

  await coordinator.evaluateRegistration(browser('0.8.0'));

  assert.equal(coordinator.state, 'ready');
  assert.equal(restarts, 0);
  assert.deepEqual(messages, []);
});

test('reports sanitized retry metadata for other failures while keeping the process alive', async () => {
  const messages: HostToExtensionMessage[] = [];
  const targets: string[] = [];
  let attempts = 0;
  let restarts = 0;
  const coordinator = coordinatorWithUpdate(
    '0.7.0',
    async target => {
      attempts += 1;
      targets.push(target);
      if (attempts === 1) throw new NativeHostUpdateFailure('network', 'private failure');
    },
    messages,
    () => {
      restarts += 1;
    },
  );

  await coordinator.evaluateRegistration(browser('0.8.0'));
  assert.equal(coordinator.state, 'failed');
  await coordinator.evaluateRegistration(browser('0.8.0'));
  assert.equal(attempts, 1);
  await coordinator.retry();

  assert.equal(attempts, 2);
  assert.equal(restarts, 1);
  assert.deepEqual(targets, ['0.8.0', '0.8.0']);
  const failed = messages.find(
    message => message.type === 'host.update.status' && message.state === 'failed',
  );
  assert.ok(failed && failed.type === 'host.update.status' && failed.state === 'failed');
  assert.equal(failed.manualCommand, 'npx --yes @panerelay/setup@0.8.0 update --yes');
  assert.doesNotMatch(JSON.stringify(failed), /private failure/);
});

test('restarts when the exact target is already installed without duplicate setup', async () => {
  let updates = 0;
  let restarts = 0;
  const coordinator = new HostReleaseCoordinator({
    hostVersion: '0.7.0',
    isTargetInstalled: target => target === '0.8.0',
    requestRestart: () => {
      restarts += 1;
    },
    runUpdate: async () => {
      updates += 1;
    },
    sendToExtension: () => {},
  });

  await coordinator.evaluateRegistration(browser('0.8.0'));
  assert.equal(updates, 0);
  assert.equal(restarts, 1);
  assert.equal(coordinator.state, 'restart-pending');
});

test('restarts a committed update even when the Extension disconnects during setup', async () => {
  let finishUpdate: (() => void) | undefined;
  const updateGate = new Promise<void>(resolve => {
    finishUpdate = resolve;
  });
  let connected = true;
  let restarts = 0;
  const coordinator = new HostReleaseCoordinator({
    hostVersion: '0.7.0',
    requestRestart: () => {
      restarts += 1;
    },
    runUpdate: () => updateGate,
    sendToExtension: () => {
      if (!connected) throw new Error('Extension transport disconnected');
    },
  });

  const operation = coordinator.evaluateRegistration(browser('0.8.0'));
  await new Promise(resolve => setImmediate(resolve));
  connected = false;
  finishUpdate?.();
  await operation;

  assert.equal(coordinator.state, 'restart-pending');
  assert.equal(restarts, 1);
});

test('serializes in-process attempts and never replaces the retained target', async () => {
  let releaseUpdate: (() => void) | undefined;
  const updateGate = new Promise<void>(resolve => {
    releaseUpdate = resolve;
  });
  let attempts = 0;
  let restarts = 0;
  const coordinator = coordinatorWithUpdate(
    '0.7.0',
    async () => {
      attempts += 1;
      await updateGate;
    },
    [],
    () => {
      restarts += 1;
    },
  );

  const first = coordinator.evaluateRegistration(browser('0.8.0'));
  await new Promise(resolve => setImmediate(resolve));
  await coordinator.evaluateRegistration(browser('0.8.0'));
  await coordinator.evaluateRegistration(browser('0.9.0'));
  assert.equal(coordinator.targetVersion, '0.8.0');
  assert.equal(attempts, 1);

  releaseUpdate?.();
  await first;
  assert.equal(restarts, 1);
});
