import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_PROTOCOL_VERSION,
  classifyCdpMethod,
  classifyCdpTargetAccess,
  isAutomationActivity,
  isAutomationActivitySnapshotMessage,
  isAutomationActivityUpdatedMessage,
  isControlSessionChangedMessage,
  isHostToExtensionMessage,
  type AutomationActivity,
  type ControlSessionSummary,
} from './index.js';

const actor = {
  kind: 'automation' as const,
  name: 'agent-browser',
  sessionLabel: 'Acceptance run',
};

const session: ControlSessionSummary = {
  id: 'relay-session',
  actor,
  state: 'active',
  participantCount: 2,
  observedTargetCount: 2,
  controlledTargetCount: 1,
  heartbeatFreshness: 'fresh',
  lastHeartbeatAt: '2026-07-29T12:00:00.000Z',
  leaseExpiresAt: '2026-07-29T12:00:30.000Z',
  updatedAt: '2026-07-29T12:00:00.000Z',
};

const activity: AutomationActivity = {
  id: 'activity-1',
  sessionId: session.id,
  actor,
  targetId: 'opaque-target',
  category: 'interaction',
  label: 'interact-with-page',
  status: 'started',
  sequence: 2,
  startedAt: '2026-07-29T12:00:01.000Z',
  updatedAt: '2026-07-29T12:00:01.000Z',
};

test('classifies CDP methods into stable provider-neutral labels', () => {
  assert.deepEqual(classifyCdpMethod('Target.attachToTarget'), {
    category: 'target',
    label: 'manage-target',
  });
  assert.deepEqual(classifyCdpMethod('Page.navigate'), {
    category: 'navigation',
    label: 'navigate-page',
  });
  assert.deepEqual(classifyCdpMethod('Input.dispatchMouseEvent'), {
    category: 'interaction',
    label: 'interact-with-page',
  });
  assert.deepEqual(classifyCdpMethod('Network.getResponseBody'), {
    category: 'network',
    label: 'inspect-network',
  });
  assert.deepEqual(classifyCdpMethod('Page.captureScreenshot'), {
    category: 'artifact',
    label: 'create-artifact',
  });
  assert.deepEqual(classifyCdpMethod('Unknown.secretOperation'), {
    category: 'other',
    label: 'run-browser-operation',
  });
});

test('classifier output cannot retain raw CDP methods or command values', () => {
  const secret = 'typed-password-and-private-url';
  const classification = classifyCdpMethod('Runtime.evaluate');
  const serialized = JSON.stringify(classification);

  assert.equal(serialized.includes('Runtime.evaluate'), false);
  assert.equal(serialized.includes(secret), false);
  assert.deepEqual(Object.keys(classification).sort(), ['category', 'label']);
});

test('classifies only explicit side-effect-free CDP methods as observation', () => {
  for (const method of [
    'Page.enable',
    'Runtime.enable',
    'Network.enable',
    'Target.setAutoAttach',
    'Runtime.runIfWaitingForDebugger',
    'Accessibility.getFullAXTree',
    'DOM.getDocument',
    'Network.getResponseBody',
    'Page.captureScreenshot',
    'Page.captureSnapshot',
    'Page.printToPDF',
    'Runtime.getProperties',
  ]) {
    assert.equal(classifyCdpTargetAccess(method), 'observe', method);
  }

  for (const method of [
    'Runtime.evaluate',
    'Runtime.callFunctionOn',
    'Page.navigate',
    'Input.dispatchMouseEvent',
    'DOM.setAttributeValue',
    'Network.setBlockedURLs',
    'Emulation.setDeviceMetricsOverride',
    'Unknown.readSomething',
  ]) {
    assert.equal(classifyCdpTargetAccess(method), 'control', method);
  }
});

test('accepts valid control status and activity messages', () => {
  const changed = {
    type: 'control.session.changed',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: 1,
    session,
  };
  const updated = {
    type: 'control.activity.updated',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: activity.sequence,
    activity,
  };
  const snapshot = {
    type: 'control.activity.snapshot',
    protocol: PANERELAY_PROTOCOL_VERSION,
    epoch: 'epoch-1',
    sequence: activity.sequence,
    firstRetainedSequence: activity.sequence,
    activities: [activity],
  };

  assert.equal(isControlSessionChangedMessage(changed), true);
  assert.equal(isAutomationActivityUpdatedMessage(updated), true);
  assert.equal(isAutomationActivitySnapshotMessage(snapshot), true);
  assert.equal(isHostToExtensionMessage(changed), true);
  assert.equal(isHostToExtensionMessage(updated), true);
  assert.equal(isHostToExtensionMessage(snapshot), true);
});

test('rejects activity records carrying raw commands, params, results, or page values', () => {
  const sensitiveFields = [
    { method: 'Runtime.evaluate' },
    { params: { expression: 'document.cookie' } },
    { result: { value: 'secret' } },
    { url: 'https://private.example/account' },
  ];

  for (const extra of sensitiveFields) {
    assert.equal(isAutomationActivity({ ...activity, ...extra }), false);
  }

  assert.equal(
    isAutomationActivityUpdatedMessage({
      type: 'control.activity.updated',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: 'epoch-1',
      sequence: activity.sequence,
      activity: { ...activity, params: { text: 'password' } },
    }),
    false,
  );
});

test('rejects malformed or inconsistent activity envelopes', () => {
  assert.equal(
    isAutomationActivityUpdatedMessage({
      type: 'control.activity.updated',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: 'epoch-1',
      sequence: 3,
      activity,
    }),
    false,
  );
  assert.equal(
    isControlSessionChangedMessage({
      type: 'control.session.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: 'epoch-1',
      sequence: 1,
      session: { ...session, rawTabId: 42 },
    }),
    false,
  );
  assert.equal(
    isControlSessionChangedMessage({
      type: 'control.session.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: 'epoch-1',
      sequence: 1,
      session: { ...session, participantCount: -1 },
    }),
    false,
  );
  assert.equal(
    isControlSessionChangedMessage({
      type: 'control.session.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: 'epoch-1',
      sequence: 1,
      session: { ...session, observedTargetCount: -1 },
    }),
    false,
  );
});
