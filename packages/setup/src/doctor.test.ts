import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { installNativeHost } from '@panerelay/bridge/install';
import { writeBrowserRegistration } from '@panerelay/browser-registry';
import { setBrowserUseEnvironmentMode } from '@panerelay/browser-use/environment';
import { PANERELAY_PROTOCOL_VERSION } from '@panerelay/protocol';
import type { CommandRunner } from '@panerelay/bridge/platform';
import { setCliAdapterMode } from '@panerelay/cli/adapter-config';
import { configureGlobalProvider } from './config.js';
import { doctorPanerelay } from './doctor.js';

test('doctor verifies the optional global default Provider', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-doctor-'));
  try {
    await configureGlobalProvider({ homeDirectory });
    const report = await doctorPanerelay({
      agentBrowser: true,
      agentBrowserProbe: async () => ({
        executable: '/bin/agent-browser',
        supported: true,
        version: '0.33.0',
      }),
      globalDefault: true,
      homeDirectory,
      platform: 'linux',
    });
    const check = report.checks.find(item => item.id === 'global-default');
    assert.equal(check?.status, 'pass');
    assert.equal(check?.detail, 'panerelay');
  } finally {
    await rm(homeDirectory, { force: true, recursive: true });
  }
});

test('doctor verifies the Browser Use user-level default', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-default-'));
  try {
    await setCliAdapterMode('browser-use', 'extension', { homeDirectory });
    await setBrowserUseEnvironmentMode('extension', { environment: {}, homeDirectory });
    const report = await doctorPanerelay({
      browserUse: true,
      browserUseProbe: async () => ({
        browserHarness: '0.1.9',
        browserUse: '0.13.8',
        browserUseExecutable: '/bin/browser-use',
      }),
      globalDefault: true,
      browserUseGatewayProbe: async () => true,
      homeDirectory,
      environment: {},
      platform: 'linux',
    });
    const check = report.checks.find(item => item.id === 'browser-use-default');
    assert.equal(check?.status, 'pass');
    assert.equal(check?.detail, 'extension');
  } finally {
    await rm(homeDirectory, { force: true, recursive: true });
  }
});

test('doctor fails an Extension default with an invalid environment or gateway', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-invalid-default-'));
  try {
    await setCliAdapterMode('browser-use', 'extension', { homeDirectory });
    const report = await doctorPanerelay({
      browserUse: true,
      browserUseProbe: async () => ({
        browserHarness: '0.1.9',
        browserUse: '0.13.8',
        browserUseExecutable: '/bin/browser-use',
      }),
      browserUseGatewayProbe: async () => false,
      globalDefault: true,
      homeDirectory,
      environment: {},
      platform: 'linux',
    });
    assert.equal(report.ok, false);
    assert.equal(report.checks.find(item => item.id === 'browser-use-default')?.status, 'fail');
    assert.equal(report.checks.find(item => item.id === 'browser-use-environment')?.status, 'fail');
    assert.equal(report.checks.find(item => item.id === 'browser-use-gateway')?.status, 'fail');
  } finally {
    await rm(homeDirectory, { force: true, recursive: true });
  }
});

test('doctor rejects a global default that omits the selected integration', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-doctor-scope-'));
  try {
    for (const scope of [{ globalDefault: true }]) {
      const report = await doctorPanerelay({
        ...scope,
        homeDirectory,
        platform: 'linux',
      });
      const check = report.checks.find(item => item.id === 'global-default-selection');
      assert.equal(report.ok, false);
      assert.equal(check?.status, 'fail');
      assert.match(check?.detail ?? '', /requires agentBrowser or browserUse/);
      assert.match(check?.hint ?? '', /global-default/);
    }
  } finally {
    await rm(homeDirectory, { force: true, recursive: true });
  }
});

test('doctor reports one minimum-version Browser Use compatibility check only when selected', async () => {
  const homeDirectory = await mkdtemp(join(tmpdir(), 'panerelay-browser-use-doctor-'));
  try {
    let probes = 0;
    const plain = await doctorPanerelay({
      browserUseProbe: async () => {
        probes += 1;
        return {};
      },
      homeDirectory,
      platform: 'linux',
    });
    assert.equal(
      plain.checks.some(check => check.id === 'browser-use'),
      false,
    );
    assert.equal(probes, 0);

    const ready = await doctorPanerelay({
      browserUse: true,
      browserUseProbe: async () => {
        probes += 1;
        return {
          browserHarness: '0.1.9',
          browserUse: '0.13.8',
          browserUseExecutable: '/venv/bin/browser-use',
        };
      },
      homeDirectory,
      platform: 'linux',
    });
    assert.equal(ready.checks.find(check => check.id === 'browser-use')?.status, 'pass');
    assert.equal(
      ready.checks.some(check => check.id === 'browser-harness'),
      false,
    );
    assert.match(
      ready.checks.find(check => check.id === 'browser-use')?.detail ?? '',
      /\/venv\/bin\/browser-use \(0\.13\.8\)/,
    );

    const incompatible = await doctorPanerelay({
      browserUse: true,
      browserUseProbe: async () => ({
        browserHarness: '0.1.7',
        browserUse: '0.13.6',
        browserUseExecutable: '/venv/bin/browser-use',
      }),
      homeDirectory,
      platform: 'linux',
    });
    assert.equal(incompatible.checks.find(check => check.id === 'browser-use')?.status, 'fail');
    assert.equal(
      incompatible.checks.some(check => check.id === 'browser-harness'),
      false,
    );

    const incomplete = await doctorPanerelay({
      browserUse: true,
      browserUseProbe: async () => ({
        browserHarness: '0.1.7',
        browserUse: '0.13.8',
        browserUseExecutable: '/venv/bin/browser-use',
      }),
      homeDirectory,
      platform: 'linux',
    });
    const browserUseCheck = incomplete.checks.find(check => check.id === 'browser-use');
    assert.equal(browserUseCheck?.status, 'fail');
    assert.match(browserUseCheck?.hint ?? '', /Repair or upgrade Browser Use/);
    assert.doesNotMatch(JSON.stringify(browserUseCheck), /Browser Harness|browser-harness/);
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
          generation: `generation-${browserId}`,
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
  await mkdir(dirname(agentBrowserPath), { recursive: true });
  await writeFile(agentBrowserPath, '#!/bin/sh\n');
  await chmod(agentBrowserPath, 0o755);
  try {
    const old = await doctorPanerelay({
      agentBrowser: true,
      commandRunner: async () => ({
        code: 0,
        stderr: '',
        stdout: 'agent-browser 0.32.9',
      }),
      environment: { PANERELAY_AGENT_BROWSER_PATH: agentBrowserPath },
      homeDirectory,
      platform: 'linux',
    });
    const oldCheck = old.checks.find(check => check.id === 'agent-browser');
    assert.equal(oldCheck?.status, 'fail');
    assert.match(oldCheck?.detail || '', /0\.32\.9/);
    assert.match(oldCheck?.hint || '', /0\.33\.0 or newer/);

    const newer = await doctorPanerelay({
      agentBrowser: true,
      commandRunner: async () => ({
        code: 0,
        stderr: '',
        stdout: 'agent-browser 0.40.0',
      }),
      environment: { PANERELAY_AGENT_BROWSER_PATH: agentBrowserPath },
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

test('doctor reports OpenCode version metadata without making it a core health requirement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-opencode-doctor-'));
  const homeDirectory = join(root, 'home');
  const binDirectory = join(root, 'bin');
  const bundledHostPath = join(root, 'native-host.bundle.cjs');
  const codexPath = join(binDirectory, 'codex');
  const opencodePath = join(binDirectory, 'opencode');
  await mkdir(binDirectory, { recursive: true });
  await writeFile(bundledHostPath, '#!/usr/bin/env node\n');
  await writeFile(codexPath, '#!/bin/sh\nexit 0\n');
  await writeFile(opencodePath, '#!/bin/sh\necho "1.18.12"\n');
  await chmod(codexPath, 0o755);
  await chmod(opencodePath, 0o755);
  try {
    await installNativeHost({
      bundledHostPath,
      environment: { PATH: binDirectory },
      homeDirectory,
      platform: 'linux',
    });
    const ready = await doctorPanerelay({ homeDirectory, platform: 'linux' });
    const readyCheck = ready.checks.find(check => check.id === 'opencode');
    assert.equal(readyCheck?.status, 'pass');
    assert.match(readyCheck?.detail ?? '', /opencode \(1\.18\.12\)/);

    await rm(opencodePath, { force: true });
    const missing = await doctorPanerelay({ homeDirectory, platform: 'linux' });
    const missingCheck = missing.checks.find(check => check.id === 'opencode');
    assert.equal(missing.ok, true);
    assert.equal(missingCheck?.status, 'warn');
    assert.match(missingCheck?.hint ?? '', /PANERELAY_OPENCODE_PATH/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
