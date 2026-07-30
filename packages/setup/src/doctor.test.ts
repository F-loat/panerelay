import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { installNativeHost } from '@panerelay/bridge/install';
import type { CommandRunner } from '@panerelay/bridge/platform';
import { configureGlobalProvider } from './config.js';
import { doctorPaneRelay } from './doctor.js';

test('doctor verifies the optional global default Provider', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-doctor-'));
  try {
    await configureGlobalProvider({ homeDirectory });
    const report = await doctorPaneRelay({
      globalProvider: true,
      homeDirectory,
      platform: 'linux',
    });
    const check = report.checks.find(item => item.id === 'global-provider');
    assert.equal(check?.status, 'pass');
    assert.equal(check?.detail, 'panerelay');
  } finally {
    await rm(homeDirectory, { force: true, recursive: true });
  }
});

test('doctor verifies Windows registry, manifest, launcher, and effective origin agreement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay windows doctor-'));
  const homeDirectory = join(root, 'home');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  const agentBrowserPath = join(root, 'agent-browser.cmd');
  const codexPath = join(root, 'codex.cmd');
  const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
  await mkdir(dirname(bundledHostPath), { recursive: true });
  await writeFile(bundledHostPath, '#!/usr/bin/env node\n');
  await writeFile(agentBrowserPath, '@exit /b 0\r\n');
  await writeFile(codexPath, '@exit /b 0\r\n');

  let manifestPath = '';
  const registryRunner: CommandRunner = async (_command, args) => {
    if (args[0] === 'query') {
      return {
        code: 0,
        stderr: '',
        stdout: `    (Default)    REG_SZ    ${manifestPath}\r\n`,
      };
    }
    manifestPath = args[6] || '';
    return { code: 0, stderr: '', stdout: '' };
  };
  try {
    const installation = await installNativeHost({
      bundledHostPath,
      environment: {
        PANERELAY_AGENT_BROWSER_PATH: agentBrowserPath,
        PANERELAY_CODEX_PATH: codexPath,
      },
      extensionId,
      homeDirectory,
      platform: 'win32',
      registryRunner,
    });
    manifestPath = installation.manifestPaths[0]!;
    const report = await doctorPaneRelay({
      homeDirectory,
      platform: 'win32',
      registryRunner,
    });
    for (const id of [
      'extension-id',
      'native-host',
      'native-launcher',
      'native-manifest',
      'windows-registry',
    ]) {
      assert.equal(
        report.checks.find(check => check.id === id)?.status,
        'pass',
        `${id} should pass`,
      );
    }

    const stale = await doctorPaneRelay({
      homeDirectory,
      platform: 'win32',
      registryRunner: async () => ({
        code: 0,
        stderr: '',
        stdout: '    (Default)    REG_SZ    C:\\stale\\manifest.json\r\n',
      }),
    });
    assert.equal(stale.checks.find(check => check.id === 'windows-registry')?.status, 'fail');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('doctor reports the detected agent-browser version and rejects versions below 0.33.0', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-version-doctor-'));
  const agentBrowserPath = join(homeDirectory, 'bin', 'agent-browser');
  const runtimeConfigPath = join(homeDirectory, '.panerelay', 'runtime.json');
  await mkdir(dirname(agentBrowserPath), { recursive: true });
  await mkdir(dirname(runtimeConfigPath), { recursive: true });
  await writeFile(agentBrowserPath, '#!/bin/sh\n');
  await chmod(agentBrowserPath, 0o755);
  await writeFile(
    runtimeConfigPath,
    `${JSON.stringify({
      agentBrowserConfigPath: join(homeDirectory, '.panerelay', 'agent-browser.json'),
      agentBrowserPath,
      extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
    })}\n`,
  );
  try {
    const old = await doctorPaneRelay({
      commandRunner: async () => ({
        code: 0,
        stderr: '',
        stdout: 'agent-browser 0.32.9',
      }),
      homeDirectory,
      platform: 'linux',
    });
    const oldCheck = old.checks.find(check => check.id === 'agent-browser');
    assert.equal(oldCheck?.status, 'fail');
    assert.match(oldCheck?.detail || '', /0\.32\.9/);
    assert.match(oldCheck?.hint || '', /0\.33\.0 or newer/);

    const newer = await doctorPaneRelay({
      commandRunner: async () => ({
        code: 0,
        stderr: '',
        stdout: 'agent-browser 0.40.0',
      }),
      homeDirectory,
      platform: 'linux',
    });
    const newerCheck = newer.checks.find(check => check.id === 'agent-browser');
    assert.equal(newerCheck?.status, 'pass');
    assert.match(newerCheck?.detail || '', /0\.40\.0/);
  } finally {
    await rm(homeDirectory, { force: true, recursive: true });
  }
});
