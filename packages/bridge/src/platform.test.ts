import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import test from 'node:test';
import {
  compareVersions,
  executableCandidatePaths,
  executableNames,
  isExecutableFile,
  parseCliVersion,
  probeExecutableVersion,
  resolveExecutablePath,
  resolveSpawnCommand,
} from './platform.js';

test('builds platform-specific executable names and PATH candidates', () => {
  assert.deepEqual(executableNames('agent-browser', 'darwin'), ['agent-browser']);
  assert.deepEqual(executableNames('agent-browser', 'linux'), ['agent-browser']);
  assert.deepEqual(executableNames('agent-browser', 'win32'), [
    'agent-browser.cmd',
    'agent-browser.exe',
    'agent-browser',
  ]);
  assert.deepEqual(
    executableCandidatePaths('qodercli', {
      configuredPath: 'C:\\Qoder & Tools\\qodercli.cmd',
      environment: { Path: 'C:\\Program Files\\node;D:\\bin' },
      platform: 'win32',
    }),
    [
      'C:\\Qoder & Tools\\qodercli.cmd',
      'C:\\Program Files\\node\\qodercli.cmd',
      'C:\\Program Files\\node\\qodercli.exe',
      'C:\\Program Files\\node\\qodercli',
      'D:\\bin\\qodercli.cmd',
      'D:\\bin\\qodercli.exe',
      'D:\\bin\\qodercli',
    ],
  );
});

test('checks existence instead of executable mode on Windows', async () => {
  const calls: Array<[string, number]> = [];
  const accessFile = async (filePath: string, mode: number): Promise<void> => {
    calls.push([filePath, mode]);
  };
  assert.equal(await isExecutableFile('C:\\bin\\tool.cmd', 'win32', accessFile), true);
  assert.equal(await isExecutableFile('/bin/tool', 'linux', accessFile), true);
  assert.deepEqual(calls, [
    ['C:\\bin\\tool.cmd', constants.F_OK],
    ['/bin/tool', constants.X_OK],
  ]);
});

test('resolves the first accessible candidate', async () => {
  const seen: string[] = [];
  const result = await resolveExecutablePath('codex', {
    configuredPath: '/missing/codex',
    environment: { PATH: '/first:/second' },
    platform: 'linux',
    accessFile: async candidate => {
      seen.push(candidate);
      if (candidate !== '/second/codex') throw new Error('missing');
    },
  });
  assert.equal(result, '/second/codex');
  assert.deepEqual(seen, ['/missing/codex', '/first/codex', '/second/codex']);
});

test('launches Windows command wrappers through ComSpec without shell interpolation', () => {
  assert.deepEqual(
    resolveSpawnCommand(
      'C:\\Program Files\\Qoder & Tools\\qodercli.cmd',
      ['--acp'],
      'win32',
      'C:\\Windows\\System32\\cmd.exe',
    ),
    {
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'C:\\Program Files\\Qoder & Tools\\qodercli.cmd', '--acp'],
    },
  );
  assert.deepEqual(resolveSpawnCommand('/usr/bin/codex', ['app-server'], 'linux'), {
    command: '/usr/bin/codex',
    args: ['app-server'],
  });
});

test('probes and compares semantic versions', async () => {
  assert.equal(parseCliVersion('agent-browser 0.33.0\n'), '0.33.0');
  assert.equal(compareVersions('0.34.1', '0.33.0'), 1);
  assert.equal(compareVersions('0.33.0', '0.33.0'), 0);
  assert.equal(compareVersions('0.32.9', '0.33.0'), -1);
  const calls: Array<{ args: string[]; command: string }> = [];
  const version = await probeExecutableVersion('C:\\npm\\agent-browser.cmd', {
    environment: { ComSpec: 'cmd.exe' },
    platform: 'win32',
    runner: async (command, args) => {
      calls.push({ args, command });
      return { code: 0, stderr: '', stdout: 'agent-browser 0.33.0' };
    },
  });
  assert.equal(version, '0.33.0');
  assert.deepEqual(calls, [
    {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'C:\\npm\\agent-browser.cmd', '--version'],
    },
  ]);
});
