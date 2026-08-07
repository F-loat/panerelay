import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { FetchAdapterRegistration } from '@panerelay/protocol';
import { dispatchFetchAdapter } from './fetch-adapter-dispatcher.js';

function registration(executablePath: string): FetchAdapterRegistration {
  return {
    manifest: {
      protocol: 'panerelay.fetch-adapter.v1',
      id: 'fixture',
      name: 'Fixture',
      version: '1.0.0',
      description: 'Test fixture.',
      entry: 'adapter.mjs',
      commands: [
        {
          name: 'show',
          description: 'Show arguments.',
          access: 'read',
          args: [],
          output: ['ok'],
          examples: ['panerelay fetch fixture show'],
        },
      ],
    },
    executablePath,
    sha256: 'a'.repeat(64),
  };
}

const active = {
  state: {
    protocol: 'panerelay.relay.v2' as const,
    pid: 1,
    port: 41_234,
    token: 'root-secret',
    generation: 'generation',
    browserId: 'browser',
    browserName: 'Chrome',
    extensionReleaseVersion: '0.8.0',
    extensionBuildVersion: '0.8.0.0',
    hostVersion: '0.8.0',
    extensionId: 'extension',
    updatedAt: new Date().toISOString(),
  },
  session: {
    protocol: 'panerelay.fetch-session.v1' as const,
    sessionId: 'session',
    endpoint: 'http://127.0.0.1:41234/fetch',
    token: 'adapter-fetch-token-secret',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  },
};

test('invokes a one-shot adapter with correlated bounded JSON', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-child-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const entry = join(root, 'adapter.mjs');
  await writeFile(
    entry,
    `
let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
process.stdout.write(JSON.stringify({
  protocol: request.protocol,
  requestId: request.requestId,
  operation: request.operation,
  success: true,
  result: { command: request.command, args: request.args, inheritedHome: process.env.HOME ?? null },
}));
`,
    { mode: 0o600 },
  );
  await chmod(entry, 0o600);

  const result = await dispatchFetchAdapter(
    registration(entry),
    active,
    'show',
    { value: 'one' },
    { environment: { HOME: '/secret-home', PATH: process.env.PATH } },
  );
  assert.deepEqual(result, { command: 'show', args: { value: 'one' }, inheritedHome: null });
});

test('redacts the fetch token from adapter errors', async t => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-fetch-child-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const entry = join(root, 'adapter.mjs');
  await writeFile(
    entry,
    `
let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
process.stdout.write(JSON.stringify({
  protocol: request.protocol,
  requestId: request.requestId,
  operation: request.operation,
  success: false,
  error: 'failed with ' + request.fetch.token,
}));
`,
    { mode: 0o600 },
  );

  await assert.rejects(dispatchFetchAdapter(registration(entry), active, 'show', {}), error => {
    assert.doesNotMatch(String(error), /adapter-fetch-token-secret/);
    assert.match(String(error), /\[redacted\]/);
    return true;
  });
});
