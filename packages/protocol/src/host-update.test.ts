import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_PROTOCOL_VERSION,
  isExtensionToHostMessage,
  isHostToExtensionMessage,
  nativeHostManualUpdateCommand,
  type BrowserRegisteredMessage,
  type HostUpdateStatusMessage,
} from './index.js';

test('requires semantic release and separate Chromium build identity during registration', () => {
  const registration = {
    type: 'browser.register',
    protocol: PANERELAY_PROTOCOL_VERSION,
    browserId: 'browser-1',
    browserName: 'Chrome',
    extensionId: 'extension-1',
    releaseVersion: '0.8.0-beta.42',
    buildVersion: '0.8.42.1',
    checkHostUpdate: true,
  };

  assert.equal(isExtensionToHostMessage(registration), true);
  assert.equal(isExtensionToHostMessage({ ...registration, checkHostUpdate: 'yes' }), false);
  const { checkHostUpdate: ___, ...withoutCheck } = registration;
  assert.equal(isExtensionToHostMessage(withoutCheck), false);
  assert.equal(isExtensionToHostMessage({ ...registration, releaseVersion: '0.8.42.1' }), false);
  assert.equal(isExtensionToHostMessage({ ...registration, buildVersion: '0.8.0' }), false);
  const { releaseVersion: _, buildVersion: __, ...legacy } = registration;
  assert.equal(isExtensionToHostMessage({ ...legacy, extensionVersion: '0.8.42.1' }), false);
});

test('requires a valid Host release in the ready registration acknowledgement', () => {
  const registered: BrowserRegisteredMessage = {
    type: 'browser.registered',
    protocol: PANERELAY_PROTOCOL_VERSION,
    browserId: 'browser-1',
    hostVersion: '0.8.0-beta.42',
  };

  assert.equal(isHostToExtensionMessage(registered), true);
  assert.equal(isHostToExtensionMessage({ ...registered, hostVersion: '0.8.42.1' }), false);
});

test('accepts bounded update lifecycle messages with an exact derived manual command', () => {
  const progress: HostUpdateStatusMessage[] = [
    {
      type: 'host.update.status',
      protocol: PANERELAY_PROTOCOL_VERSION,
      state: 'required',
      hostVersion: '0.7.0',
      targetVersion: '0.8.0-beta.42',
      retryAvailable: false,
    },
    {
      type: 'host.update.status',
      protocol: PANERELAY_PROTOCOL_VERSION,
      state: 'updating',
      hostVersion: '0.7.0',
      targetVersion: '0.8.0-beta.42',
      retryAvailable: false,
    },
    {
      type: 'host.update.status',
      protocol: PANERELAY_PROTOCOL_VERSION,
      state: 'restart-pending',
      hostVersion: '0.7.0',
      targetVersion: '0.8.0-beta.42',
      retryAvailable: false,
    },
    {
      type: 'host.update.status',
      protocol: PANERELAY_PROTOCOL_VERSION,
      state: 'failed',
      hostVersion: '0.7.0',
      targetVersion: '0.8.0-beta.42',
      retryAvailable: true,
      error: 'network',
      detail: 'The exact package could not be resolved.',
      manualCommand: nativeHostManualUpdateCommand('0.8.0-beta.42'),
    },
    {
      type: 'host.update.status',
      protocol: PANERELAY_PROTOCOL_VERSION,
      state: 'incompatible',
      hostVersion: '0.9.0',
      targetVersion: '0.8.0-beta.42',
      retryAvailable: false,
      reason: 'newer-host',
    },
    {
      type: 'host.update.status',
      protocol: PANERELAY_PROTOCOL_VERSION,
      state: 'incompatible',
      hostVersion: '0.9.0',
      retryAvailable: false,
      reason: 'invalid-extension-release',
    },
  ];

  for (const message of progress) assert.equal(isHostToExtensionMessage(message), true);
});

test('rejects adversarial update status and retry payloads', () => {
  const failed = {
    type: 'host.update.status',
    protocol: PANERELAY_PROTOCOL_VERSION,
    state: 'failed',
    hostVersion: '0.7.0',
    targetVersion: '0.8.0',
    retryAvailable: true,
    error: 'setup-failed',
    manualCommand: nativeHostManualUpdateCommand('0.8.0'),
  };
  for (const message of [
    { ...failed, targetVersion: '@panerelay/setup@latest' },
    { ...failed, manualCommand: 'npx --yes malicious-package' },
    { ...failed, packageName: '@panerelay/setup' },
    { ...failed, detail: 'x'.repeat(241) },
    { ...failed, hostVersion: '0.9.0' },
  ]) {
    assert.equal(isHostToExtensionMessage(message), false);
  }

  assert.equal(
    isExtensionToHostMessage({
      type: 'host.update.retry',
      protocol: PANERELAY_PROTOCOL_VERSION,
    }),
    true,
  );
  for (const extra of [
    { targetVersion: '0.8.0' },
    { packageName: '@panerelay/setup' },
    { command: 'npx anything' },
    { args: ['--yes'] },
  ]) {
    assert.equal(
      isExtensionToHostMessage({
        type: 'host.update.retry',
        protocol: PANERELAY_PROTOCOL_VERSION,
        ...extra,
      }),
      false,
    );
  }
});
