import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_PROTOCOL_VERSION,
  isExtensionToHostMessage,
  isHostToExtensionMessage,
  normalizeAutomationCapability,
  type IntegrationRequestMessage,
  type IntegrationResponseMessage,
  type AgentRequestMessage,
} from './index.js';

test('accepts correlated integration requests from the Extension', () => {
  const request: IntegrationRequestMessage = {
    type: 'integration.request',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId: 'integration-1',
    request: { method: 'default-provider.clear' },
  };

  assert.equal(isExtensionToHostMessage(request), true);
});

test('accepts browser capability registration and rejects malformed capability values', () => {
  assert.equal(
    isExtensionToHostMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'browser-1',
      browserName: 'Microsoft Edge',
      browserFamily: 'edge',
      capabilities: { cdpRelay: true },
      extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
      extensionVersion: '0.2.0',
    }),
    true,
  );
  assert.equal(
    isExtensionToHostMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'browser-1',
      browserName: 'Firefox',
      browserFamily: 'firefox',
      capabilities: { cdpRelay: 'no' },
      extensionId: 'panerelay@panerelay.dev',
      extensionVersion: '0.2.0',
    }),
    false,
  );
  assert.equal(
    isExtensionToHostMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'browser-2',
      browserName: 'Firefox',
      browserFamily: 'firefox',
      capabilities: { automation: { transport: 'webdriver', ready: true } },
      extensionId: 'panerelay@panerelay.dev',
      extensionVersion: '0.2.0',
    }),
    true,
  );
  assert.equal(
    isExtensionToHostMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'browser-2',
      browserName: 'Firefox',
      browserFamily: 'firefox',
      capabilities: { automation: { transport: 'cdp', ready: 'yes' } },
      extensionId: 'panerelay@panerelay.dev',
      extensionVersion: '0.2.0',
    }),
    false,
  );
  assert.equal(
    isExtensionToHostMessage({
      type: 'browser.register',
      protocol: PANERELAY_PROTOCOL_VERSION,
      browserId: 'browser-2',
      browserName: 'Firefox',
      browserFamily: 'firefox',
      capabilities: { automation: { transport: 'none', ready: true } },
      extensionId: 'panerelay@panerelay.dev',
      extensionVersion: '0.2.0',
    }),
    false,
  );
});

test('normalizes legacy and explicit browser automation transports', () => {
  assert.deepEqual(normalizeAutomationCapability(), { transport: 'cdp', ready: true });
  assert.deepEqual(normalizeAutomationCapability({ cdpRelay: true }), {
    transport: 'cdp',
    ready: true,
  });
  assert.deepEqual(normalizeAutomationCapability({ cdpRelay: false }), {
    transport: 'none',
    ready: false,
  });
  assert.deepEqual(
    normalizeAutomationCapability({
      cdpRelay: false,
      automation: { transport: 'webdriver', ready: true },
    }),
    { transport: 'webdriver', ready: true },
  );
});

test('accepts bounded Firefox WebDriver readiness and rendezvous messages', () => {
  assert.equal(
    isHostToExtensionMessage({
      type: 'webdriver.readiness',
      protocol: PANERELAY_PROTOCOL_VERSION,
      ready: true,
      reason: 'ready',
      message: 'Firefox WebDriver automation is ready',
    }),
    true,
  );
  assert.equal(
    isExtensionToHostMessage({
      type: 'webdriver.authorization.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      mode: 'single-tab',
    }),
    true,
  );
  assert.equal(
    isExtensionToHostMessage({
      type: 'webdriver.rendezvous.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: 'request-1',
      challenge: 'challenge-value-1234',
      success: true,
      targetId: 'opaque-target',
      documentId: 'opaque-document',
      active: true,
    }),
    true,
  );
  assert.equal(
    isExtensionToHostMessage({
      type: 'webdriver.target.invalidated',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId: 'opaque-target',
      documentId: 'opaque-document',
      reason: 'navigation',
    }),
    true,
  );
});

test('accepts conversation start context without a raw tab identifier', () => {
  const request = {
    type: 'agent.request',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId: 'agent-1',
    request: {
      method: 'conversation.start',
      providerId: 'codex',
      options: {
        cwd: '/workspace/project',
        initialPage: { url: 'https://example.com/app', title: 'Example app' },
      },
    },
  };

  assert.equal(isExtensionToHostMessage(request), true);
  assert.equal(JSON.stringify(request).includes('tabId'), false);
});

test('accepts bounded image input on a conversation send request', () => {
  const request: AgentRequestMessage = {
    type: 'agent.request',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId: 'agent-image-1',
    request: {
      method: 'conversation.send',
      providerId: 'codex',
      conversationId: 'conversation-1',
      text: '',
      images: [{ data: 'AQID', mimeType: 'image/png', name: 'screenshot.png' }],
    },
  };

  assert.equal(isExtensionToHostMessage(request), true);
});

test('accepts integration responses from the Native Host', () => {
  const response: IntegrationResponseMessage = {
    type: 'integration.response',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId: 'integration-1',
    success: true,
    result: {
      provider: 'codex',
      isPanerelay: false,
    },
  };

  assert.equal(isHostToExtensionMessage(response), true);
});

test('accepts workspace directory picker requests and results', () => {
  const request: IntegrationRequestMessage = {
    type: 'integration.request',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId: 'workspace-1',
    request: { method: 'workspace.pick-directory' },
  };
  const response: IntegrationResponseMessage = {
    type: 'integration.response',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId: 'workspace-1',
    success: true,
    result: { path: '/workspace/project' },
  };

  assert.equal(isExtensionToHostMessage(request), true);
  assert.equal(isHostToExtensionMessage(response), true);
});

test('rejects integration messages from another protocol version', () => {
  assert.equal(
    isExtensionToHostMessage({
      type: 'integration.request',
      protocol: 'panerelay.relay.v2',
      requestId: 'integration-1',
      request: { method: 'default-provider.get' },
    }),
    false,
  );
});
