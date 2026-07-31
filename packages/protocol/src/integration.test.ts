import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_PROTOCOL_VERSION,
  isExtensionToHostMessage,
  isHostToExtensionMessage,
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

test('accepts Edge capability registration and rejects malformed capability values', () => {
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
      browserName: 'Unsupported browser',
      browserFamily: 'unknown',
      capabilities: { cdpRelay: 'no' },
      extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
      extensionVersion: '0.2.0',
    }),
    false,
  );
});

test('accepts project-scoped conversation history requests', () => {
  const request: AgentRequestMessage = {
    type: 'agent.request',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId: 'agent-list-1',
    request: {
      method: 'conversation.list',
      providerId: 'claude',
      cwd: '/workspace/project',
    },
  };

  assert.equal(isExtensionToHostMessage(request), true);
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
