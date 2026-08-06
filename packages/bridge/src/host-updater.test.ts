import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NativeHostUpdateFailure,
  nativeHostUpdateCommand,
  runNativeHostUpdate,
} from './host-updater.js';

test('builds only the fixed exact-version non-interactive Host update command', () => {
  assert.deepEqual(nativeHostUpdateCommand('0.8.0-beta.42'), {
    args: ['--yes', '@panerelay/setup@0.8.0-beta.42', 'update', '--yes'],
    manualCommand: 'npx --yes @panerelay/setup@0.8.0-beta.42 update --yes',
    packageSpec: '@panerelay/setup@0.8.0-beta.42',
  });
  for (const value of ['latest', '../0.8.0', '0.8.0;calc', '@panerelay/setup@0.8.0']) {
    assert.throws(() => nativeHostUpdateCommand(value), /valid Panerelay release/, value);
  }
});

test('uses structured Windows-safe process arguments without integration flags', async () => {
  const calls: Array<{ args: string[]; command: string; timeoutMs?: number }> = [];
  await runNativeHostUpdate('0.8.0', {
    environment: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    packageRunner: 'C:\\Program Files\\Node & Tools\\npx.cmd',
    platform: 'win32',
    runner: async (command, args, options) => {
      calls.push({ args, command, timeoutMs: options?.timeoutMs });
      return { code: 0, stderr: 'private stderr', stdout: 'private stdout' };
    },
    timeoutMs: 12_345,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.equal(calls[0]?.timeoutMs, 12_345);
  assert.match(calls[0]?.args.join(' ') ?? '', /@panerelay\/setup@0\.8\.0/);
  assert.doesNotMatch(calls[0]?.args.join(' ') ?? '', /agent-browser|browser-use|playwright/);
});

test('returns bounded stable failure categories without exposing child output', async () => {
  await assert.rejects(
    runNativeHostUpdate('0.8.0', {
      packageRunner: '/test/npx',
      runner: async () => ({ code: 1, stderr: 'secret child output', stdout: 'private' }),
    }),
    (error: unknown) => {
      assert.ok(error instanceof NativeHostUpdateFailure);
      assert.equal(error.updateError, 'setup-failed');
      assert.doesNotMatch(error.message, /secret|private/);
      return true;
    },
  );

  for (const [stderr, expected] of [
    ['npm error code ETARGET\nnpm error No matching version found', 'package-unavailable'],
    ['npm error code E404\n404 Not Found', 'package-unavailable'],
    ['npm error code ENOTFOUND\nnetwork request failed', 'network'],
    ['setup failed with ENOENT while replacing a managed file', 'setup-failed'],
  ] as const) {
    await assert.rejects(
      runNativeHostUpdate('0.8.0', {
        packageRunner: '/test/npx',
        runner: async () => ({ code: 1, stderr, stdout: 'private registry output' }),
      }),
      (error: unknown) => {
        assert.ok(error instanceof NativeHostUpdateFailure);
        assert.equal(error.updateError, expected);
        assert.doesNotMatch(error.message, /ETARGET|E404|ENOTFOUND|private|registry/);
        return true;
      },
    );
  }

  await assert.rejects(
    runNativeHostUpdate('0.8.0', {
      packageRunner: '/test/npx',
      runner: async () => {
        throw new Error('command timed out with private offline details');
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof NativeHostUpdateFailure);
      assert.equal(error.updateError, 'timeout');
      assert.doesNotMatch(error.message, /private|offline/);
      return true;
    },
  );
});
