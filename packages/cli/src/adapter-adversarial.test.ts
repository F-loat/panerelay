import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION, type CliAdapterMode } from '@panerelay/protocol';
import { CliAdapterDispatchError, resolveCliConnection } from './adapter-dispatcher.js';
import {
  registerCliAdapter,
  type CliAdapterRegistration,
  type CliAdapterRegistryOptions,
} from './adapter-registry.js';

type AdapterBehavior =
  'valid' | 'incompatible' | 'oversized' | 'slow' | 'over-permissioned' | 'generation-changed';

const selection = {
  source: 'single' as const,
  state: {
    protocol: 'panerelay.relay.v1' as const,
    pid: 123,
    port: 41_234,
    token: 'bridge-bearer-must-not-cross-stdio',
    generation: 'native-host-generation-1',
    browserId: 'opaque-browser',
    browserName: 'Chrome',
    browserFamily: 'chrome' as const,
    capabilities: { cdpRelay: true },
    extensionVersion: '0.2.0',
    extensionId: 'extension-id',
    updatedAt: '2026-08-01T01:02:03.000Z',
  },
};

function adapterSource(behavior: AdapterBehavior): string {
  return `#!/usr/bin/env node
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const request = JSON.parse(input);
  const behavior = ${JSON.stringify(behavior)};
  if (behavior === 'oversized') {
    process.stdout.write('x'.repeat(70000));
    return;
  }
  if (behavior === 'slow') {
    setTimeout(() => process.stdout.write('{}'), 500);
    return;
  }
  const manifest = {
    adapterId: behavior === 'incompatible' ? 'different-adapter' : 'browser-use',
    name: 'Browser Use adapter fixture',
    version: '0.2.0',
    protocol: 'panerelay.cli-adapter.v1',
    capabilities: ['connection.resolve', 'adapter.doctor'],
    modes: ['direct', 'extension'],
    childEnvironmentKeys: ['BU_CDP_URL', 'BU_NAME'],
  };
  let response;
  if (request.operation === 'adapter.manifest') {
    response = { protocol: request.protocol, requestId: request.requestId, operation: request.operation, success: true, result: manifest };
  } else if (behavior === 'generation-changed') {
    process.stderr.write('bridge-bearer-must-never-print');
    response = { protocol: request.protocol, requestId: request.requestId, operation: request.operation, success: false, error: { code: 'generation-changed', message: 'bridge-bearer-must-never-print', retryable: true } };
    process.exitCode = 3;
  } else {
    const environment = behavior === 'over-permissioned'
      ? { BU_CDP_URL: 'http://127.0.0.1/ticket', PATH: '/malicious' }
      : { BU_CDP_URL: 'http://127.0.0.1/ticket', BU_NAME: 'panerelay' };
    response = { protocol: request.protocol, requestId: request.requestId, operation: request.operation, success: true, result: { mode: 'extension', connection: { kind: 'cdp-http', url: 'http://127.0.0.1/ticket' }, environment, expiresAt: '2099-08-01T01:02:03.000Z', concurrencyKey: 'browser-use-lane' } };
  }
  process.stdout.write(JSON.stringify(response));
});
`;
}

async function fixture(): Promise<{
  directory: string;
  executablePath: string;
  options: CliAdapterRegistryOptions;
  register(behavior: AdapterBehavior): Promise<void>;
}> {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-cli-adversarial-'));
  const dataDirectory = join(directory, 'data');
  const adapterDirectory = join(dataDirectory, 'adapters', 'browser-use', '0.2.0');
  const executablePath = join(adapterDirectory, 'panerelay-browser-use');
  const options = {
    dataDirectory,
    registryPath: join(dataDirectory, 'cli-adapters.json'),
  };
  return {
    directory,
    executablePath,
    options,
    register: async behavior => {
      await mkdir(adapterDirectory, { recursive: true, mode: 0o700 });
      if (process.platform !== 'win32') {
        await chmod(dataDirectory, 0o700);
        await chmod(join(dataDirectory, 'adapters'), 0o700);
        await chmod(join(dataDirectory, 'adapters', 'browser-use'), 0o700);
        await chmod(adapterDirectory, 0o700);
      }
      await writeFile(executablePath, adapterSource(behavior), { mode: 0o700 });
      if (process.platform !== 'win32') await chmod(executablePath, 0o700);
      const registration: CliAdapterRegistration = {
        adapterId: 'browser-use',
        version: '0.2.0',
        executablePath,
        protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
        capabilities: ['connection.resolve', 'adapter.doctor'],
        modes: ['direct', 'extension'] satisfies CliAdapterMode[],
        childEnvironmentKeys: ['BU_CDP_URL', 'BU_NAME'],
      };
      await registerCliAdapter(registration, options);
    },
  };
}

async function resolveFixture(
  options: CliAdapterRegistryOptions,
  timeoutMs = 2_000,
): Promise<unknown> {
  return resolveCliConnection(
    { adapterId: 'browser-use', actor: { name: 'Browser Use' }, mode: 'extension' },
    {
      adapterInvocation: { timeoutMs },
      adapterRegistry: options,
      dependencies: { selectBrowserRegistration: async () => selection },
      environment: process.env,
    },
  );
}

test('rejects missing and permission-tampered adapter executables', async () => {
  const current = await fixture();
  try {
    await current.register('valid');
    await unlink(current.executablePath);
    await assert.rejects(
      resolveFixture(current.options),
      (error: unknown) =>
        error instanceof CliAdapterDispatchError && error.code === 'adapter-unavailable',
    );

    await current.register('valid');
    if (process.platform !== 'win32') {
      await chmod(current.executablePath, 0o722);
      await assert.rejects(
        resolveFixture(current.options),
        (error: unknown) =>
          error instanceof CliAdapterDispatchError && error.code === 'adapter-unavailable',
      );
    }
  } finally {
    await rm(current.directory, { force: true, recursive: true });
  }
});

test('rejects incompatible, oversized, slow, and over-permissioned adapter output', async () => {
  for (const [behavior, expectedCode, timeoutMs] of [
    ['incompatible', 'adapter-incompatible', 2_000],
    ['oversized', 'adapter-invalid-response', 2_000],
    ['slow', 'adapter-timeout', 60],
    ['over-permissioned', 'adapter-invalid-response', 2_000],
  ] as const) {
    const current = await fixture();
    try {
      await current.register(behavior);
      await assert.rejects(
        resolveFixture(current.options, timeoutMs),
        (error: unknown) => error instanceof CliAdapterDispatchError && error.code === expectedCode,
        behavior,
      );
    } finally {
      await rm(current.directory, { force: true, recursive: true });
    }
  }
});

test('redacts adapter stderr and error messages during a browser-generation race', async () => {
  const current = await fixture();
  try {
    await current.register('generation-changed');
    await assert.rejects(resolveFixture(current.options), (error: unknown) => {
      assert.ok(error instanceof CliAdapterDispatchError);
      assert.equal(error.code, 'generation-changed');
      assert.doesNotMatch(error.message, /bridge-bearer/);
      return true;
    });
  } finally {
    await rm(current.directory, { force: true, recursive: true });
  }
});
