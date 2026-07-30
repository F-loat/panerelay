import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_PROTOCOL_VERSION,
  type HostToExtensionMessage,
  type IntegrationRequest,
} from '@panerelay/protocol';
import { IntegrationService } from './integration-service.js';

function request(method: IntegrationRequest['method'], requestId: string = method) {
  return {
    type: 'integration.request' as const,
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId,
    request: { method } as IntegrationRequest,
  };
}

test('routes default-provider integration operations and returns current state', async () => {
  const sent: HostToExtensionMessage[] = [];
  const calls: string[] = [];
  const service = new IntegrationService(message => sent.push(message), {
    readDefaultProvider: async () => {
      calls.push('get');
      return { path: '/config', provider: null, isPanerelay: false };
    },
    setDefaultProvider: async () => {
      calls.push('set');
      return { path: '/config', provider: 'panerelay', isPanerelay: true };
    },
    clearDefaultProvider: async () => {
      calls.push('clear');
      return { path: '/config', provider: null, isPanerelay: false };
    },
  });

  await service.handle(request('default-provider.get'));
  await service.handle(request('default-provider.set'));
  await service.handle(request('default-provider.clear'));

  assert.deepEqual(calls, ['get', 'set', 'clear']);
  assert.deepEqual(
    sent.map(message =>
      message.type === 'integration.response'
        ? { success: message.success, result: message.result }
        : message,
    ),
    [
      { success: true, result: { provider: null, isPanerelay: false } },
      { success: true, result: { provider: 'panerelay', isPanerelay: true } },
      { success: true, result: { provider: null, isPanerelay: false } },
    ],
  );
});

test('returns a correlated error when configuration cannot be read', async () => {
  const sent: HostToExtensionMessage[] = [];
  const service = new IntegrationService(message => sent.push(message), {
    readDefaultProvider: async () => {
      throw new Error('Invalid agent-browser configuration');
    },
  });

  await service.handle(request('default-provider.get', 'settings-1'));

  assert.deepEqual(sent, [
    {
      type: 'integration.response',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: 'settings-1',
      success: false,
      error: 'Invalid agent-browser configuration',
    },
  ]);
});
