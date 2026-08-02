import assert from 'node:assert/strict';
import test from 'node:test';
import type { AutomationIntegrationId } from '@panerelay/protocol';
import { installAutomationIntegration, integrationSetupCommand } from './integration-installer.js';

test('maps only supported integrations to lockstep setup package arguments', () => {
  assert.deepEqual(integrationSetupCommand('agent-browser', '0.2.0'), {
    args: ['--yes', '@panerelay/setup@0.2.0', '--agent-browser'],
    manualCommand: 'npx --yes @panerelay/setup --agent-browser',
    packageSpec: '@panerelay/setup@0.2.0',
  });
  assert.deepEqual(integrationSetupCommand('browser-use', '0.2.0-beta.12'), {
    args: ['--yes', '@panerelay/setup@0.2.0-beta.12', '--browser-use'],
    manualCommand: 'npx --yes @panerelay/setup --browser-use',
    packageSpec: '@panerelay/setup@0.2.0-beta.12',
  });
  assert.throws(
    () => integrationSetupCommand('custom' as AutomationIntegrationId, '0.2.0'),
    /Unsupported Panerelay integration/,
  );
  assert.throws(
    () => integrationSetupCommand('agent-browser', 'latest'),
    /Extension version cannot select a setup package/,
  );
});

test('runs the fixed package command with a bounded timeout and no shell on POSIX', async () => {
  const calls: Array<{ command: string; args: string[]; timeoutMs?: number }> = [];
  await installAutomationIntegration('browser-use', '0.2.0', {
    environment: { PATH: '/usr/local/bin' },
    packageRunner: '/usr/local/bin/npx',
    platform: 'darwin',
    timeoutMs: 12_345,
    runner: async (command, args, options) => {
      calls.push({ command, args, timeoutMs: options?.timeoutMs });
      return { code: 0, stderr: '', stdout: '' };
    },
  });
  assert.deepEqual(calls, [
    {
      command: '/usr/local/bin/npx',
      args: ['--yes', '@panerelay/setup@0.2.0', '--browser-use'],
      timeoutMs: 12_345,
    },
  ]);
});

test('does not return captured package output when setup fails', async () => {
  await assert.rejects(
    installAutomationIntegration('agent-browser', '0.2.0', {
      packageRunner: '/usr/local/bin/npx',
      platform: 'darwin',
      runner: async () => ({
        code: 1,
        stderr: 'private setup stderr',
        stdout: 'private setup stdout',
      }),
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /npx --yes @panerelay\/setup --agent-browser/);
      assert.doesNotMatch(error.message, /private setup/);
      return true;
    },
  );
});
