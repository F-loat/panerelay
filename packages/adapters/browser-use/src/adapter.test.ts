import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  parseCliAdapterResponse,
  serializeCliAdapterMessage,
  type CliAdapterRequest,
  type BridgeState,
} from '@panerelay/protocol';
import {
  BROWSER_USE_CHILD_ENVIRONMENT_KEYS,
  browserUseInstallationStatus,
  handleBrowserUseAdapterRequest,
  isStableVersionAtLeast,
  probeBrowserUseVersions,
} from './adapter.js';
import { browserUseGatewayUrl } from './environment.js';

function request(operation: CliAdapterRequest['operation']): CliAdapterRequest {
  return {
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    requestId: `request-${operation}`,
    operation,
    input: {},
  } as CliAdapterRequest;
}

const state: BridgeState = {
  protocol: 'panerelay.relay.v2',
  pid: 123,
  port: 41_234,
  token: 'bridge-bearer-never-returned',
  generation: 'native-host-generation-1',
  browserId: 'opaque-browser',
  browserName: 'Chrome',
  browserFamily: 'chrome',
  capabilities: { cdpRelay: true },
  extensionReleaseVersion: '0.2.0',
  extensionBuildVersion: '0.2.0.0',
  hostVersion: '0.2.0',
  extensionId: 'extension-id',
  updatedAt: '2026-08-01T01:02:03.000Z',
};

function resolveRequest(
  mode: 'direct' | 'extension' = 'extension',
  actorName = 'Browser Use',
): CliAdapterRequest {
  return {
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    requestId: `resolve-${mode}`,
    operation: 'connection.resolve',
    input: {
      mode,
      actor: { name: actorName, sessionLabel: 'skill-run' },
      ...(mode === 'extension'
        ? { browser: { browserId: state.browserId, generation: state.generation } }
        : {}),
    },
  };
}

test('reports a compatible generic manifest and minimum-version doctor readiness', async () => {
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
    probeVersions: async () => ({
      browserUse: '0.14.0',
      browserHarness: '0.1.9',
      browserUseExecutable: '/venv/bin/browser-use',
    }),
  });
  assert.equal(ready.success, true);
  if (!ready.success) assert.fail('doctor failed');
  assert.equal((ready.result as { status: string }).status, 'ready');

  const unavailable = await handleBrowserUseAdapterRequest(request('adapter.doctor'), {
    probeVersions: async () => ({
      browserUse: '0.13.6',
      browserHarness: '0.1.8',
      browserUseExecutable: '/venv/bin/browser-use',
    }),
  });
  assert.equal(unavailable.success, true);
  if (!unavailable.success) assert.fail('doctor failed');
  assert.equal((unavailable.result as { status: string }).status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(unavailable), /Browser Harness|browser-harness/);
  assert.ok(JSON.stringify(unavailable).length < 2_048);
});

test('compares stable versions against the floor and rejects ambiguous versions', () => {
  for (const version of ['0.13.7', '0.13.7+local.1', '0.13.8', '0.14.0', '1.0.0']) {
    assert.equal(isStableVersionAtLeast(version, '0.13.7'), true, version);
  }
  for (const version of [undefined, '', '0.13.6', '0.13.7rc1', '0.14.0-beta.1', 'latest']) {
    assert.equal(isStableVersionAtLeast(version, '0.13.7'), false, String(version));
  }
});

test('fails one Browser Use status closed for incomplete internal runtime metadata', async () => {
  assert.equal(
    browserUseInstallationStatus({
      browserUse: '0.13.7',
      browserUseExecutable: '/venv/bin/browser-use',
    }),
    'incomplete',
  );
  const response = await handleBrowserUseAdapterRequest(request('adapter.doctor'), {
    probeVersions: async () => ({
      browserUse: '0.13.8',
      browserHarness: '0.1.7',
      browserUseExecutable: '/venv/bin/browser-use',
    }),
  });
  assert.equal(response.success, true);
  if (!response.success) assert.fail('doctor failed');
  assert.equal((response.result as { status: string }).status, 'unavailable');
  assert.equal((response.result as { checks: unknown[] }).checks.length, 2);
  assert.match(JSON.stringify(response), /Browser Use installation is incomplete/);
  assert.doesNotMatch(JSON.stringify(response), /Browser Harness|browser-harness/);
});

test('the standalone executable serves one bounded stdio request', () => {
  const input = serializeCliAdapterMessage(request('adapter.manifest'));
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./index.js', import.meta.url))],
    {
      encoding: 'utf8',
      input,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const response = parseCliAdapterResponse(result.stdout.trim());
  assert.equal(response.success, true);
  assert.equal(response.operation, 'adapter.manifest');
});

test('resolves an env shebang target and preserves its interpreter arguments', async t => {
  if (process.platform === 'win32') {
    t.skip('POSIX shebang behavior');
    return;
  }
  const fixture = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-shebang-'));
  const browserUse = join(fixture, 'browser-use');
  const fakePython = join(fixture, 'fake-python');
  try {
    await writeFile(browserUse, '#!/usr/bin/env fake-python --isolated\n', { mode: 0o700 });
    await writeFile(
      fakePython,
      `#!${process.execPath}\nconsole.log(JSON.stringify({browserUse:'0.13.7',browserHarness:'0.1.8'}));\n`,
      { mode: 0o700 },
    );
    await chmod(browserUse, 0o700);
    await chmod(fakePython, 0o700);
    assert.deepEqual(
      await probeBrowserUseVersions(
        {
          PATH: `${fixture}${delimiter}${process.env.PATH ?? ''}`,
          PANERELAY_BROWSER_USE_EXECUTABLE: browserUse,
        },
        process.platform,
      ),
      {
        browserUseExecutable: browserUse,
        browserUse: '0.13.7',
        browserHarness: '0.1.8',
      },
    );
  } finally {
    await rm(fixture, { force: true, recursive: true });
  }
});

test('resolves the stable Browser Use gateway independently from actor labels', async () => {
  const response = await handleBrowserUseAdapterRequest(
    resolveRequest('extension', 'Research Agent'),
    {
      homeDirectory: '/protected-user',
    },
  );
  assert.equal(response.success, true);
  if (!response.success) assert.fail('resolution failed');
  const gatewayUrl = browserUseGatewayUrl({
    browserId: state.browserId,
    generation: state.generation,
  });
  assert.deepEqual(response.result, {
    mode: 'extension',
    connection: { kind: 'cdp-http', url: gatewayUrl },
    environment: {
      ANONYMIZED_TELEMETRY: 'false',
      BH_RECORD: '0',
      BH_TELEMETRY: '0',
      BU_CDP_URL: gatewayUrl,
      BU_NAME: 'panerelay',
    },
    concurrencyKey: 'browser-use:panerelay',
  });
  assert.doesNotMatch(JSON.stringify(response), /bridge-bearer/);
});

test('bypasses all adapter connection state in Direct mode', async () => {
  const response = await handleBrowserUseAdapterRequest(resolveRequest('direct'));
  assert.equal(response.success, true);
  if (!response.success) assert.fail('direct failed');
  assert.deepEqual(response.result, {
    mode: 'direct',
    connection: { kind: 'direct' },
    environment: {},
  });
});

test('the publish artifact contains only the runtime, metadata, README, and license', async () => {
  const packageDirectory = new URL('..', import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL('package.json', packageDirectory), 'utf8'),
  ) as { name: string; version: string; engines: { node: string } };
  assert.equal(manifest.name, '@panerelay/browser-use');
  assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
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
