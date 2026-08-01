import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION } from '@panerelay/protocol';
import {
  cliAdapterRegistryPath,
  readCliAdapterRegistry,
  readCliAdapterRegistration,
  registerCliAdapter,
  removeCliAdapterRegistration,
  type CliAdapterRegistration,
  type CliAdapterRegistryOptions,
} from './adapter-registry.js';

function registration(
  dataDirectory: string,
  adapterId: string,
  environmentKey: string,
): CliAdapterRegistration {
  return {
    adapterId,
    version: '0.2.0',
    executablePath: join(dataDirectory, 'adapters', adapterId, 'adapter.cjs'),
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    capabilities: ['connection.resolve', 'adapter.doctor'],
    modes: ['direct', 'extension'],
    childEnvironmentKeys: [environmentKey],
  };
}

test('atomically registers protected exact adapter paths and preserves unrelated entries', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'panerelay-cli-adapters-'));
  const dataDirectory = join(fixture, 'panerelay-data');
  const options: CliAdapterRegistryOptions = { dataDirectory };
  try {
    const first = registration(dataDirectory, 'first-adapter', 'FIRST_CONNECTION_URL');
    const second = registration(dataDirectory, 'second-adapter', 'SECOND_CONNECTION_URL');
    await Promise.all(
      [first, second].map(async adapter => {
        await mkdir(join(adapter.executablePath, '..'), { recursive: true });
        await writeFile(adapter.executablePath, '#!/usr/bin/env node\n', { mode: 0o700 });
      }),
    );
    if (process.platform !== 'win32') await chmod(dataDirectory, 0o700);

    await registerCliAdapter(first, options);
    await registerCliAdapter(second, options);
    assert.deepEqual(
      (await readCliAdapterRegistry(options)).adapters.map(adapter => adapter.adapterId),
      ['first-adapter', 'second-adapter'],
    );
    assert.deepEqual(await readCliAdapterRegistration('first-adapter', options), first);

    const registryPath = cliAdapterRegistryPath(options);
    assert.equal((await lstat(registryPath)).mode & 0o077, 0);
    assert.equal(
      JSON.parse(await readFile(registryPath, 'utf8')).protocol,
      'panerelay.cli-adapter-registry.v1',
    );

    await removeCliAdapterRegistration('first-adapter', options);
    assert.deepEqual((await readCliAdapterRegistry(options)).adapters, [second]);
    await removeCliAdapterRegistration('missing-adapter', options);
    assert.deepEqual((await readCliAdapterRegistry(options)).adapters, [second]);
  } finally {
    await rm(fixture, { force: true, recursive: true });
  }
});

test('rejects relative, outside, incompatible, and over-permissioned registrations', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'panerelay-cli-adapters-invalid-'));
  const dataDirectory = join(fixture, 'panerelay-data');
  const options: CliAdapterRegistryOptions = { dataDirectory };
  try {
    const valid = registration(dataDirectory, 'fixture-adapter', 'FIXTURE_CONNECTION_URL');
    await assert.rejects(
      registerCliAdapter({ ...valid, executablePath: 'adapter.cjs' }, options),
      /registration is invalid/,
    );
    await assert.rejects(
      registerCliAdapter({ ...valid, executablePath: join(fixture, 'outside.cjs') }, options),
      /registration is invalid/,
    );
    await assert.rejects(
      registerCliAdapter(
        { ...valid, protocol: 'panerelay.cli-adapter.v2' as typeof valid.protocol },
        options,
      ),
      /registration is invalid/,
    );
    await assert.rejects(
      registerCliAdapter({ ...valid, childEnvironmentKeys: ['PATH'] }, options),
      /registration is invalid/,
    );
  } finally {
    await rm(fixture, { force: true, recursive: true });
  }
});

test('fails closed for a tampered or broadly readable registry', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'panerelay-cli-adapters-tampered-'));
  const dataDirectory = join(fixture, 'panerelay-data');
  const options: CliAdapterRegistryOptions = { dataDirectory };
  try {
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') await chmod(dataDirectory, 0o700);
    const registryPath = cliAdapterRegistryPath(options);
    await writeFile(
      registryPath,
      JSON.stringify({ protocol: 'panerelay.cli-adapter-registry.v1', adapters: 'tampered' }),
      { mode: 0o600 },
    );
    await assert.rejects(readCliAdapterRegistry(options), /registry is invalid/);
    await writeFile(
      registryPath,
      JSON.stringify({ protocol: 'panerelay.cli-adapter-registry.v1', adapters: [] }),
      { mode: 0o600 },
    );
    if (process.platform !== 'win32') {
      await chmod(registryPath, 0o644);
      await assert.rejects(readCliAdapterRegistry(options), /permissions are too broad/);
    }
  } finally {
    await rm(fixture, { force: true, recursive: true });
  }
});

test('validates Windows absolute paths without accepting PATH-style names', async () => {
  const options: CliAdapterRegistryOptions = {
    dataDirectory: 'C:\\Users\\fixture\\.panerelay',
    platform: 'win32',
    registryPath: 'C:\\Users\\fixture\\.panerelay\\cli-adapters.json',
  };
  const valid = {
    ...registration('C:\\Users\\fixture\\.panerelay', 'fixture-adapter', 'FIXTURE_URL'),
    executablePath: 'C:\\Users\\fixture\\.panerelay\\adapters\\fixture-adapter\\adapter.cjs',
  };
  await assert.rejects(
    registerCliAdapter({ ...valid, executablePath: 'adapter.cmd' }, options),
    /registration is invalid/,
  );
});
