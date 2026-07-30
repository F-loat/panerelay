import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_PROTOCOL_VERSION,
  isExtensionToHostMessage,
  isHostToExtensionMessage,
  type IntegrationRequestMessage,
  type IntegrationResponseMessage,
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
