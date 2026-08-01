import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLI_ADAPTER_MAX_MESSAGE_BYTES,
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  isCliAdapterManifest,
  isCliAdapterRequest,
  isCliAdapterResponse,
  isSafeCliAdapterEnvironmentKey,
  parseCliAdapterRequest,
  parseCliAdapterResponse,
  serializeCliAdapterMessage,
  type CliAdapterManifest,
  type CliAdapterRequest,
  type CliAdapterResponse,
} from './cli-adapter.js';

const manifest: CliAdapterManifest = {
  adapterId: 'fixture-adapter',
  name: 'Fixture connection adapter',
  version: '0.2.0',
  protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  capabilities: ['connection.resolve', 'adapter.doctor'],
  modes: ['direct', 'extension'],
  childEnvironmentKeys: ['FIXTURE_CONNECTION_URL', 'FIXTURE_RUNTIME_DIR'],
};

test('validates generic manifest, resolve, and doctor requests exactly', () => {
  const requests: CliAdapterRequest[] = [
    {
      protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
      requestId: 'manifest-1',
      operation: 'adapter.manifest',
      input: {},
    },
    {
      protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
      requestId: 'resolve-1',
      operation: 'connection.resolve',
      input: {
        mode: 'extension',
        actor: { name: 'fixture-agent', sessionLabel: 'fixture-run' },
        browser: { browserId: 'opaque-browser', generation: 'generation-1' },
      },
    },
    {
      protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
      requestId: 'doctor-1',
      operation: 'adapter.doctor',
      input: {},
    },
  ];
  for (const request of requests) {
    assert.equal(isCliAdapterRequest(request), true);
    assert.deepEqual(parseCliAdapterRequest(serializeCliAdapterMessage(request)), request);
  }

  assert.equal(isCliAdapterRequest({ ...requests[0], input: { unexpected: true } }), false);
  assert.equal(
    isCliAdapterRequest({
      ...requests[1],
      protocol: 'panerelay.cli-adapter.v2',
    }),
    false,
  );
  assert.equal(
    isCliAdapterRequest({
      ...requests[1],
      input: { mode: 'extension', actor: { name: 'fixture-agent' } },
    }),
    false,
  );
  assert.equal(
    isCliAdapterRequest({
      ...requests[1],
      input: {
        mode: 'direct',
        actor: { name: 'fixture-agent' },
        browser: { browserId: 'opaque-browser', generation: 'generation-1' },
      },
    }),
    false,
  );
});

test('validates operation-specific success and bounded failure envelopes', () => {
  const responses: CliAdapterResponse[] = [
    {
      protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
      requestId: 'manifest-1',
      operation: 'adapter.manifest',
      success: true,
      result: manifest,
    },
    {
      protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
      requestId: 'resolve-1',
      operation: 'connection.resolve',
      success: true,
      result: {
        mode: 'extension',
        connection: { kind: 'cdp-http', url: 'http://127.0.0.1:43111/ticket' },
        environment: {
          FIXTURE_CONNECTION_URL: 'http://127.0.0.1:43111/ticket',
          FIXTURE_RUNTIME_DIR: '/tmp/fixture-runtime',
        },
        expiresAt: '2026-08-01T01:00:00.000Z',
        concurrencyKey: 'fixture-lane',
      },
    },
    {
      protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
      requestId: 'doctor-1',
      operation: 'adapter.doctor',
      success: true,
      result: {
        status: 'ready',
        checks: [{ id: 'engine', status: 'pass', version: '1.2.3' }],
      },
    },
    {
      protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
      requestId: 'resolve-2',
      operation: 'connection.resolve',
      success: false,
      error: {
        code: 'browser-unavailable',
        message: 'The selected browser is unavailable',
        retryable: true,
      },
    },
  ];
  for (const response of responses) {
    assert.equal(isCliAdapterResponse(response), true);
    assert.deepEqual(parseCliAdapterResponse(serializeCliAdapterMessage(response)), response);
  }

  assert.equal(
    isCliAdapterResponse({
      ...responses[0],
      operation: 'adapter.doctor',
    }),
    false,
  );
  assert.equal(
    isCliAdapterResponse({
      ...responses[3],
      error: { code: 'secret-adapter-code', message: 'failed', retryable: false },
    }),
    false,
  );
});

test('rejects unsafe environment authority and Browser Use-specific protocol coupling', () => {
  for (const key of [
    'PATH',
    'HOME',
    'USERPROFILE',
    'NODE_OPTIONS',
    'PYTHONPATH',
    'LD_PRELOAD',
    'DYLD_INSERT_LIBRARIES',
    'lowercase',
  ]) {
    assert.equal(isSafeCliAdapterEnvironmentKey(key), false, key);
  }
  assert.equal(isSafeCliAdapterEnvironmentKey('FIXTURE_CONNECTION_URL'), true);
  assert.equal(isCliAdapterManifest({ ...manifest, childEnvironmentKeys: ['PATH'] }), false);
  assert.equal(JSON.stringify(manifest).includes('BU_'), false);
  assert.equal(JSON.stringify(manifest).includes('browser-use'), false);
});

test('enforces message bounds before parsing or serializing', () => {
  assert.throws(() => parseCliAdapterRequest('{'), /not valid JSON/);
  assert.throws(
    () => parseCliAdapterResponse('x'.repeat(CLI_ADAPTER_MAX_MESSAGE_BYTES + 1)),
    /size limit/,
  );
  const response: CliAdapterResponse = {
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    requestId: 'failure-1',
    operation: 'adapter.doctor',
    success: false,
    error: {
      code: 'internal-error',
      message: 'x'.repeat(CLI_ADAPTER_MAX_MESSAGE_BYTES),
      retryable: false,
    },
  };
  assert.throws(() => serializeCliAdapterMessage(response), /size limit/);
});
