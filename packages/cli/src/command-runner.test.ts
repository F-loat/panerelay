import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runCliConnectionCommand } from './command-runner.js';
import { CliAdapterDispatchError } from './adapter-dispatcher.js';

test('runs the exact child arguments with scoped environment and returns its exit status', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-cli-run-'));
  const outputPath = join(directory, 'child.json');
  const originalValue = process.env.PANERELAY_TEST_CHILD_VALUE;
  delete process.env.PANERELAY_TEST_CHILD_VALUE;
  try {
    const status = await runCliConnectionCommand(
      {
        adapterId: 'browser-use',
        actor: { name: 'Browser Use' },
        mode: 'extension',
        childCommand: [
          process.execPath,
          '-e',
          "require('node:fs').writeFileSync(process.argv[1], JSON.stringify({args:process.argv.slice(2), value:process.env.PANERELAY_TEST_CHILD_VALUE})); process.exit(7)",
          outputPath,
          '--upstream-option',
          '--lang',
          'zh-CN',
        ],
      },
      {
        environment: { SAFE_PARENT_VALUE: 'preserved' },
        runnerDependencies: {
          resolveConnection: async input => ({
            adapterId: input.adapterId,
            mode: 'extension',
            connection: { kind: 'cdp-http', url: 'http://127.0.0.1/cdp/bootstrap/ticket' },
            environment: { PANERELAY_TEST_CHILD_VALUE: 'scoped' },
          }),
        },
      },
    );
    assert.equal(status, 7);
    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), {
      args: ['--upstream-option', '--lang', 'zh-CN'],
      value: 'scoped',
    });
    assert.equal(process.env.PANERELAY_TEST_CHILD_VALUE, undefined);
  } finally {
    if (originalValue === undefined) delete process.env.PANERELAY_TEST_CHILD_VALUE;
    else process.env.PANERELAY_TEST_CHILD_VALUE = originalValue;
    await rm(directory, { force: true, recursive: true });
  }
});

test('rejects an empty child command before resolving a connection', async () => {
  let resolved = false;
  await assert.rejects(
    runCliConnectionCommand(
      { adapterId: 'browser-use', actor: { name: 'Browser Use' }, childCommand: [] },
      {
        runnerDependencies: {
          resolveConnection: async () => {
            resolved = true;
            throw new Error('must not resolve');
          },
        },
      },
    ),
    /child command is required/i,
  );
  assert.equal(resolved, false);
});

test('holds the adapter concurrency lock for the child lifetime', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-cli-run-lock-'));
  const resolveConnection = async (input: { adapterId: string }) => ({
    adapterId: input.adapterId,
    mode: 'extension' as const,
    connection: { kind: 'cdp-http' as const, url: 'http://127.0.0.1/bootstrap' },
    environment: {},
    concurrencyKey: 'browser-use-lane',
  });
  const input = {
    adapterId: 'browser-use',
    actor: { name: 'Browser Use' },
    childCommand: [process.execPath, '-e', 'setTimeout(() => {}, 180)'],
  };
  try {
    const first = runCliConnectionCommand(input, {
      concurrencyLock: { lockDirectory: directory, waitMs: 20 },
      runnerDependencies: { resolveConnection },
    });
    await new Promise(resolve => setTimeout(resolve, 40));
    await assert.rejects(
      runCliConnectionCommand(input, {
        concurrencyLock: { lockDirectory: directory, waitMs: 20 },
        runnerDependencies: { resolveConnection },
      }),
      (error: unknown) => error instanceof CliAdapterDispatchError && error.code === 'busy',
    );
    assert.equal(await first, 0);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
