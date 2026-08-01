import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  parseCliAdapterResponse,
  serializeCliAdapterMessage,
  type CliAdapterRequest,
  type BridgeState,
} from '@panerelay/protocol';
import { BROWSER_USE_CHILD_ENVIRONMENT_KEYS, handleBrowserUseAdapterRequest } from './adapter.js';

function request(operation: CliAdapterRequest['operation']): CliAdapterRequest {
  return {
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    requestId: `request-${operation}`,
    operation,
    input: {},
  } as CliAdapterRequest;
}

const state: BridgeState = {
  protocol: 'panerelay.relay.v1',
  pid: 123,
  port: 41_234,
  token: 'bridge-bearer-never-returned',
  generation: 'native-host-generation-1',
  browserId: 'opaque-browser',
  browserName: 'Chrome',
  browserFamily: 'chrome',
  capabilities: { cdpRelay: true },
  extensionVersion: '0.2.0',
  extensionId: 'extension-id',
  updatedAt: '2026-08-01T01:02:03.000Z',
};

function resolveRequest(mode: 'direct' | 'extension' = 'extension'): CliAdapterRequest {
  return {
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    requestId: `resolve-${mode}`,
    operation: 'connection.resolve',
    input: {
      mode,
      actor: { name: 'Browser Use', sessionLabel: 'skill-run' },
      ...(mode === 'extension'
        ? { browser: { browserId: state.browserId, generation: state.generation } }
        : {}),
    },
  };
}

test('reports a compatible generic manifest and pinned doctor readiness', async () => {
  const manifest = await handleBrowserUseAdapterRequest(request('adapter.manifest'), {
    adapterVersion: '0.2.0',
  });
  assert.equal(manifest.success, true);
  if (!manifest.success) assert.fail('manifest failed');
  assert.deepEqual(manifest.result, {
    adapterId: 'browser-use',
    name: 'Panerelay Browser Use connection adapter',
    version: '0.2.0',
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    capabilities: ['connection.resolve', 'adapter.doctor'],
    modes: ['direct', 'extension'],
    childEnvironmentKeys: [...BROWSER_USE_CHILD_ENVIRONMENT_KEYS],
  });

  const ready = await handleBrowserUseAdapterRequest(request('adapter.doctor'), {
    probeVersions: async () => ({ browserUse: '0.13.7', browserHarness: '0.1.8' }),
  });
  assert.equal(ready.success, true);
  if (!ready.success) assert.fail('doctor failed');
  assert.equal((ready.result as { status: string }).status, 'ready');

  const unavailable = await handleBrowserUseAdapterRequest(request('adapter.doctor'), {
    probeVersions: async () => ({ browserUse: '0.13.6' }),
  });
  assert.equal(unavailable.success, true);
  if (!unavailable.success) assert.fail('doctor failed');
  assert.equal((unavailable.result as { status: string }).status, 'unavailable');
  assert.ok(JSON.stringify(unavailable).length < 2_048);
});

test('the standalone executable serves one bounded stdio request', () => {
  const input = serializeCliAdapterMessage(request('adapter.manifest'));
  const result = spawnSync(process.execPath, [new URL('./index.js', import.meta.url).pathname], {
    encoding: 'utf8',
    input,
  });
  assert.equal(result.status, 0, result.stderr);
  const response = parseCliAdapterResponse(result.stdout.trim());
  assert.equal(response.success, true);
  assert.equal(response.operation, 'adapter.manifest');
});

test('rereads only the selected live generation and requests an authenticated ticket', async () => {
  let readBrowserId: string | undefined;
  let fetchUrl: string | undefined;
  let fetchAuthorization: string | undefined;
  let fetchPayload: unknown;
  const response = await handleBrowserUseAdapterRequest(resolveRequest(), {
    homeDirectory: '/protected-user',
    readLiveBrowserRegistration: async browserId => {
      readBrowserId = browserId;
      return state;
    },
    fetch: async (input, init) => {
      fetchUrl = String(input);
      fetchAuthorization = (init?.headers as Record<string, string>).authorization;
      fetchPayload = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          protocol: 'panerelay.relay.v1',
          cdpUrl: `http://127.0.0.1:${state.port}/cdp/bootstrap/${'a'.repeat(43)}`,
          expiresAt: '2099-08-01T01:02:03.000Z',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  assert.equal(readBrowserId, 'opaque-browser');
  assert.equal(fetchUrl, `http://127.0.0.1:${state.port}/cdp/bootstrap`);
  assert.equal(fetchAuthorization, `Bearer ${state.token}`);
  assert.deepEqual(fetchPayload, {
    protocol: 'panerelay.relay.v1',
    browser: { browserId: state.browserId, generation: state.generation },
    actor: { kind: 'automation', name: 'Browser Use', sessionLabel: 'skill-run' },
    laneKey: 'browser-use:panerelay',
    connectionPolicy: 'single',
  });
  assert.equal(response.success, true);
  if (!response.success) assert.fail('resolution failed');
  assert.deepEqual(response.result, {
    mode: 'extension',
    connection: {
      kind: 'cdp-http',
      url: `http://127.0.0.1:${state.port}/cdp/bootstrap/${'a'.repeat(43)}`,
    },
    environment: {
      ANONYMIZED_TELEMETRY: 'false',
      BH_RECORD: '0',
      BH_RUNTIME_DIR: '/protected-user/.panerelay/browser-use/runtime',
      BH_RUNTIME_DIR_SHARED: '0',
      BH_TELEMETRY: '0',
      BH_TMP_DIR: '/protected-user/.panerelay/browser-use/tmp',
      BH_TMP_DIR_SHARED: '0',
      BU_CDP_URL: `http://127.0.0.1:${state.port}/cdp/bootstrap/${'a'.repeat(43)}`,
      BU_NAME: 'panerelay',
    },
    expiresAt: '2099-08-01T01:02:03.000Z',
    concurrencyKey: 'browser-use:panerelay',
  });
  assert.doesNotMatch(JSON.stringify(response), /bridge-bearer/);
});

test('bypasses all adapter connection state in Direct mode', async () => {
  let read = false;
  let fetched = false;
  const response = await handleBrowserUseAdapterRequest(resolveRequest('direct'), {
    readLiveBrowserRegistration: async () => {
      read = true;
      return state;
    },
    fetch: async () => {
      fetched = true;
      throw new Error('must not fetch');
    },
  });
  assert.equal(read, false);
  assert.equal(fetched, false);
  assert.equal(response.success, true);
  if (!response.success) assert.fail('direct failed');
  assert.deepEqual(response.result, {
    mode: 'direct',
    connection: { kind: 'direct' },
    environment: {},
  });
});

test('fails closed for unavailable, changed, unsupported, and rejected browser connections', async () => {
  const cases = [
    {
      name: 'unavailable',
      read: async () => null,
      expected: 'browser-unavailable',
    },
    {
      name: 'generation',
      read: async () => ({ ...state, generation: 'replacement-generation' }),
      expected: 'generation-changed',
    },
    {
      name: 'unsupported',
      read: async () => ({ ...state, capabilities: { cdpRelay: false } }),
      expected: 'not-ready',
    },
  ] as const;
  for (const item of cases) {
    let fetched = false;
    const response = await handleBrowserUseAdapterRequest(resolveRequest(), {
      readLiveBrowserRegistration: item.read,
      fetch: async () => {
        fetched = true;
        throw new Error('must not fetch');
      },
    });
    assert.equal(response.success, false, item.name);
    if (response.success) assert.fail(item.name);
    assert.equal(response.error.code, item.expected);
    assert.equal(fetched, false);
    assert.doesNotMatch(JSON.stringify(response), /bridge-bearer/);
  }

  for (const [status, bridgeCode, expected] of [
    [401, 'unauthorized', 'not-ready'],
    [409, 'generation-changed', 'generation-changed'],
    [429, 'ticket-limit', 'busy'],
    [503, 'browser-unavailable', 'browser-unavailable'],
  ] as const) {
    const response = await handleBrowserUseAdapterRequest(resolveRequest(), {
      readLiveBrowserRegistration: async () => state,
      fetch: async () =>
        new Response(
          JSON.stringify({
            protocol: 'panerelay.relay.v1',
            error: { code: bridgeCode, message: 'bridge-bearer-never-returned' },
          }),
          { status },
        ),
    });
    assert.equal(response.success, false);
    if (response.success) assert.fail(`status ${status}`);
    assert.equal(response.error.code, expected);
    assert.doesNotMatch(JSON.stringify(response), /bridge-bearer/);
  }
});

test('rejects a bootstrap URL that does not belong to the selected Bridge', async () => {
  const response = await handleBrowserUseAdapterRequest(resolveRequest(), {
    readLiveBrowserRegistration: async () => state,
    fetch: async () =>
      new Response(
        JSON.stringify({
          protocol: 'panerelay.relay.v1',
          cdpUrl: `http://127.0.0.1:49999/cdp/bootstrap/${'a'.repeat(43)}`,
          expiresAt: '2099-08-01T01:02:03.000Z',
        }),
        { status: 201 },
      ),
  });
  assert.equal(response.success, false);
  if (response.success) assert.fail('wrong Bridge URL accepted');
  assert.equal(response.error.code, 'not-ready');
});

test('the publish artifact contains only the runtime, metadata, README, and license', async () => {
  const packageDirectory = new URL('..', import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL('package.json', packageDirectory), 'utf8'),
  ) as { name: string; version: string; bin: Record<string, string>; engines: { node: string } };
  assert.equal(manifest.name, '@panerelay/browser-use');
  assert.equal(manifest.version, '0.2.0');
  assert.equal(manifest.bin['panerelay-browser-use'], './dist/index.js');
  assert.equal(manifest.engines.node, '>=20');

  const packed = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: packageDirectory,
    encoding: 'utf8',
  });
  assert.equal(packed.status, 0, packed.stderr);
  const inventory = JSON.parse(packed.stdout) as [{ files: Array<{ path: string }> }];
  const paths = inventory[0].files.map(file => file.path);
  assert.ok(paths.includes('dist/index.js'));
  assert.ok(paths.includes('dist/adapter.js'));
  assert.ok(paths.includes('README.md'));
  assert.ok(paths.includes('LICENSE'));
  assert.equal(
    paths.some(path => path.startsWith('src/')),
    false,
  );
  assert.equal(
    paths.some(path => path.includes('.test.')),
    false,
  );
});
