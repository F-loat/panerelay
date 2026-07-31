import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { installNativeHost } from '@panerelay/bridge/install';
import { writeBrowserRegistration } from '@panerelay/browser-registry';
import { PANERELAY_PROTOCOL_VERSION } from '@panerelay/protocol';
import type { CommandRunner } from '@panerelay/bridge/platform';
import { configureGlobalProvider } from './config.js';
import { doctorPanerelay } from './doctor.js';

test('doctor verifies the optional global default Provider', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-doctor-'));
  try {
    await configureGlobalProvider({ homeDirectory });
    const report = await doctorPanerelay({
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

test('doctor recognizes multiple independent browser registrations', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-multi-browser-doctor-'));
  const extensionId = 'panplnkjlkoceaonlmpdekjphgmbggmi';
  const options = {
    registryDirectory: join(homeDirectory, '.panerelay', 'browsers'),
  };
  try {
    for (const [browserId, browserName, browserFamily] of [
      ['chrome-id', 'Google Chrome', 'chrome'],
      ['edge-id', 'Microsoft Edge', 'edge'],
    ] as const) {
      await writeBrowserRegistration(
        {
          protocol: PANERELAY_PROTOCOL_VERSION,
          pid: process.pid,
          port: browserFamily === 'chrome' ? 41_001 : 41_002,
          token: `token-${browserId}`,
          browserId,
          browserName,
          browserFamily,
          capabilities: { cdpRelay: true },
          extensionVersion: '0.2.0',
          extensionId,
          updatedAt: '2026-07-31T08:00:00.000Z',
        },
        options,
      );
    }

    const report = await doctorPanerelay({ homeDirectory, platform: 'linux' });
    const check = report.checks.find(item => item.id === 'extension');
    assert.equal(check?.status, 'pass');
    assert.equal(check?.detail, 'Connected through 2 browser processes');
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

  const registryValues = new Map<string, string>();
  const registryRunner: CommandRunner = async (_command, args) => {
    if (args[0] === 'query') {
      return {
        code: 0,
        stderr: '',
        stdout: `    (Default)    REG_SZ    ${registryValues.get(args[1] || '') || ''}\r\n`,
      };
    }
    registryValues.set(args[1] || '', args[6] || '');
    return { code: 0, stderr: '', stdout: '' };
  };
  try {
    await installNativeHost({
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
    const report = await doctorPanerelay({
      homeDirectory,
      platform: 'win32',
      registryRunner,
    });
    for (const id of [
      'extension-id',
      'native-host',
      'native-launcher',
      'native-manifest',
      'windows-registry-chrome',
      'windows-registry-edge',
    ]) {
      assert.equal(
        report.checks.find(check => check.id === id)?.status,
        'pass',
        `${id} should pass`,
      );
    }

    const stale = await doctorPanerelay({
      homeDirectory,
      platform: 'win32',
      registryRunner: async () => ({
        code: 0,
        stderr: '',
        stdout: '    (Default)    REG_SZ    C:\\stale\\manifest.json\r\n',
      }),
    });
    assert.equal(
      stale.checks.find(check => check.id === 'windows-registry-chrome')?.status,
      'fail',
    );
    assert.equal(stale.checks.find(check => check.id === 'windows-registry-edge')?.status, 'fail');
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
    const old = await doctorPanerelay({
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

    const newer = await doctorPanerelay({
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

test('doctor reports an installed Claude CLI below 2.1.206 as optional but incompatible', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-claude-doctor-'));
  const claudePath = join(homeDirectory, 'bin', 'claude');
  const runtimeConfigPath = join(homeDirectory, '.panerelay', 'runtime.json');
  await mkdir(dirname(claudePath), { recursive: true });
  await mkdir(dirname(runtimeConfigPath), { recursive: true });
  await writeFile(claudePath, '#!/bin/sh\n');
  await chmod(claudePath, 0o755);
  try {
    await writeFile(
      runtimeConfigPath,
      `${JSON.stringify({
        claudePath,
        claudeVersion: '2.0.99',
        extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
      })}\n`,
    );
    const old = await doctorPanerelay({ homeDirectory, platform: 'linux' });
    const oldCheck = old.checks.find(check => check.id === 'claude');
    assert.equal(oldCheck?.status, 'warn');
    assert.match(oldCheck?.detail || '', /2\.0\.99/);
    assert.match(oldCheck?.hint || '', /2\.1\.206 or newer/);

    await writeFile(
      runtimeConfigPath,
      `${JSON.stringify({
        claudePath,
        claudeVersion: '2.1.206',
        extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
      })}\n`,
    );
    const supported = await doctorPanerelay({ homeDirectory, platform: 'linux' });
    const supportedCheck = supported.checks.find(check => check.id === 'claude');
    assert.equal(supportedCheck?.status, 'pass');
    assert.match(supportedCheck?.detail || '', /2\.1\.206/);
  } finally {
    await rm(homeDirectory, { force: true, recursive: true });
  }
});
