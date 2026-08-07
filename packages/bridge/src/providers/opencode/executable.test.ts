import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  openCodeExecutableCandidatePaths,
  openCodeInstallCommand,
  resolveOpenCodeExecutable,
} from './executable.js';

test('discovers explicit, PATH, npm, and user-local OpenCode candidates', () => {
  const candidates = openCodeExecutableCandidatePaths({
    configuredPath: 'C:\\Configured\\opencode.cmd',
    environment: {
      APPDATA: 'C:\\Users\\Test\\AppData\\Roaming',
      Path: 'C:\\Path One;D:\\bin',
    },
    homeDirectory: 'C:\\Users\\Test',
    persistedPath: 'C:\\Cached\\opencode.exe',
    platform: 'win32',
    processExecPath: 'C:\\Program Files\\nodejs\\node.exe',
  });
  assert.equal(candidates[0], 'C:\\Configured\\opencode.cmd');
  assert.ok(candidates.includes('C:\\Path One\\opencode.cmd'));
  assert.ok(candidates.includes('C:\\Users\\Test\\AppData\\Roaming\\npm\\opencode.cmd'));
  assert.ok(candidates.includes('C:\\Users\\Test\\.local\\bin\\opencode.exe'));
  assert.ok(candidates.includes('C:\\Users\\Test\\.opencode\\bin\\opencode'));
  assert.equal(candidates.at(-1), 'C:\\Cached\\opencode.exe');
  assert.equal(openCodeInstallCommand(), 'npm install -g opencode-ai');
});

test('keeps explicit overrides authoritative and probes persisted discoveries last', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'panerelay-opencode-order-'));
  const explicitDirectory = path.join(root, 'explicit');
  const liveDirectory = path.join(root, 'live');
  const persistedDirectory = path.join(root, 'persisted');
  const executableName = process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
  const explicitPath = path.join(explicitDirectory, executableName);
  const livePath = path.join(liveDirectory, executableName);
  const persistedPath = path.join(persistedDirectory, executableName);
  const environment: NodeJS.ProcessEnv =
    process.platform === 'win32'
      ? { ComSpec: 'C:\\Windows\\System32\\cmd.exe', Path: liveDirectory }
      : { PATH: liveDirectory };
  await Promise.all(
    [explicitDirectory, liveDirectory, persistedDirectory].map(directory =>
      mkdir(directory, { recursive: true }),
    ),
  );
  await Promise.all(
    [explicitPath, livePath, persistedPath].map(filePath => writeFile(filePath, 'fixture')),
  );
  if (process.platform !== 'win32') {
    await Promise.all(
      [explicitPath, livePath, persistedPath].map(filePath => chmod(filePath, 0o755)),
    );
  }

  try {
    const checked: string[] = [];
    const runner = async (command: string, args: string[]) => {
      checked.push(JSON.stringify([command, args]));
      return { code: 0, stderr: '', stdout: '1.18.12' };
    };
    const explicit = await resolveOpenCodeExecutable({
      configuredPath: explicitPath,
      environment,
      homeDirectory: path.join(root, 'missing-home'),
      persistedPath,
      platform: process.platform,
      runner,
    });
    assert.equal(explicit.executable, explicitPath);
    assert.equal(checked.length, 1);
    assert.match(checked[0] ?? '', new RegExp(path.basename(explicitPath)));

    checked.length = 0;
    const live = await resolveOpenCodeExecutable({
      environment,
      homeDirectory: path.join(root, 'missing-home'),
      persistedPath,
      platform: process.platform,
      runner,
    });
    assert.equal(live.executable, livePath);
    assert.equal(checked.length, 1);
    assert.doesNotMatch(checked[0] ?? '', new RegExp(path.basename(persistedDirectory)));

    checked.length = 0;
    const persisted = await resolveOpenCodeExecutable({
      environment: process.platform === 'win32' ? { ComSpec: environment.ComSpec } : {},
      homeDirectory: path.join(root, 'missing-home'),
      persistedPath,
      platform: process.platform,
      runner,
    });
    assert.equal(persisted.executable, persistedPath);
    assert.equal(checked.length, 1);

    const deduplicated = openCodeExecutableCandidatePaths({
      configuredPath: livePath,
      environment,
      homeDirectory: path.join(root, 'missing-home'),
      persistedPath: livePath,
      platform: process.platform,
    });
    assert.equal(deduplicated.filter(candidate => candidate === livePath).length, 1);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('probes OpenCode command wrappers and reports failures without leaking output', async () => {
  const checked: Array<{ args: string[]; command: string }> = [];
  const result = await resolveOpenCodeExecutable({
    configuredPath: process.execPath,
    environment: {},
    homeDirectory: '/missing',
    platform: process.platform,
    runner: async (command, args) => {
      checked.push({ command, args });
      return { code: 0, stderr: '', stdout: '1.18.12' };
    },
  });
  assert.equal(result.executable, process.execPath);
  assert.equal(result.version, '1.18.12');
  assert.equal(checked.length, 1);

  const directory = await mkdtemp(path.join(tmpdir(), 'panerelay-opencode-wrapper-'));
  try {
    const wrapper = path.join(directory, 'opencode.cmd');
    await writeFile(wrapper, '@echo off\r\n');
    const wrapperResult = await resolveOpenCodeExecutable({
      configuredPath: wrapper,
      environment: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
      homeDirectory: 'C:\\Missing',
      platform: 'win32',
      runner: async (command, args, options) => {
        assert.equal(command, 'C:\\Windows\\System32\\cmd.exe');
        assert.deepEqual(args.slice(0, 3), ['/d', '/s', '/c']);
        assert.equal(options?.windowsVerbatimArguments, true);
        return { code: 0, stderr: '', stdout: 'opencode 1.18.12' };
      },
    });
    assert.equal(wrapperResult.version, '1.18.12');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }

  const incompatible = await resolveOpenCodeExecutable({
    configuredPath: process.execPath,
    environment: {},
    homeDirectory: '/missing',
    platform: process.platform,
    runner: async () => ({ code: 1, stderr: 'sensitive output', stdout: '' }),
  });
  assert.equal(
    incompatible.error,
    'OpenCode candidates were found, but none passed the version probe.',
  );
  assert.doesNotMatch(incompatible.error || '', /sensitive/);
});

test('reports missing OpenCode with an explicit override hint', async () => {
  const result = await resolveOpenCodeExecutable({
    environment: {},
    homeDirectory: '/definitely-missing-opencode-home',
    platform: process.platform,
  });
  assert.equal(
    result.error,
    'OpenCode was not found. Install OpenCode or set PANERELAY_OPENCODE_PATH.',
  );
});
