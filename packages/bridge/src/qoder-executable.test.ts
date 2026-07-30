import assert from 'node:assert/strict';
import test from 'node:test';
import {
  qoderExecutableCandidatePaths,
  qoderInstallCommand,
  resolveQoderExecutable,
} from './qoder-executable.js';

test('discovers explicit, PATH, npm, user-local, and versioned Qoder candidates', async () => {
  const candidates = await qoderExecutableCandidatePaths({
    configuredPath: 'C:\\Configured\\qodercli.cmd',
    environment: {
      APPDATA: 'C:\\Users\\Test\\AppData\\Roaming',
      Path: 'C:\\Path One;D:\\bin',
    },
    homeDirectory: 'C:\\Users\\Test',
    platform: 'win32',
    processExecPath: 'C:\\Program Files\\nodejs\\node.exe',
    readdirVersioned: async () => ['README.txt', 'qodercli-1.1.2', 'qodercli-1.2.0'],
  });
  assert.equal(candidates[0], 'C:\\Configured\\qodercli.cmd');
  assert.ok(candidates.includes('C:\\Path One\\qodercli.cmd'));
  assert.ok(candidates.includes('C:\\Users\\Test\\AppData\\Roaming\\npm\\qodercli.cmd'));
  assert.ok(candidates.includes('C:\\Users\\Test\\.local\\bin\\qodercli.exe'));
  assert.ok(candidates.includes('C:\\Users\\Test\\.qoder\\bin\\qodercli'));
  assert.ok(
    candidates.indexOf('C:\\Users\\Test\\.qoder\\bin\\qodercli\\qodercli-1.2.0') <
      candidates.indexOf('C:\\Users\\Test\\.qoder\\bin\\qodercli\\qodercli-1.1.2'),
  );
  assert.equal(qoderInstallCommand('win32'), 'npm install -g @qoder-ai/qodercli');
});

test('probes candidates in order and reports incompatible installs without leaking output', async () => {
  const checked: string[] = [];
  const result = await resolveQoderExecutable({
    configuredPath: process.execPath,
    environment: {},
    homeDirectory: '/missing',
    platform: process.platform,
    readdirVersioned: async () => [],
    runner: async (command, args) => {
      checked.push(`${command} ${args.join(' ')}`);
      return { code: 0, stderr: '', stdout: 'qodercli 1.1.2' };
    },
  });
  assert.equal(result.executable, process.execPath);
  assert.equal(result.version, '1.1.2');
  assert.equal(checked.length, 1);

  const incompatible = await resolveQoderExecutable({
    configuredPath: process.execPath,
    environment: {},
    homeDirectory: '/missing',
    platform: process.platform,
    readdirVersioned: async () => [],
    runner: async () => ({ code: 1, stderr: 'sensitive output', stdout: '' }),
  });
  assert.equal(
    incompatible.error,
    'Qoder CLI candidates were found, but none passed the version probe.',
  );
  assert.doesNotMatch(incompatible.error || '', /sensitive/);
});
