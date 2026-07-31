import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  PANERELAY_FIREFOX_MANAGED_TOKEN_ENV,
  firefoxLaunchArguments,
  firefoxLauncherContent,
  isManagedFirefoxEnvironment,
  launchManagedFirefox,
  validateFirefoxProfile,
  validateMarionettePort,
  type FirefoxAutomationRuntimeConfig,
} from './firefox-automation.js';

test('validates only absolute profiles and bounded Marionette ports', () => {
  assert.equal(validateFirefoxProfile('/Users/test/Firefox', 'darwin'), '/Users/test/Firefox');
  assert.equal(validateFirefoxProfile('C:\\Firefox\\Profile', 'win32'), 'C:\\Firefox\\Profile');
  assert.throws(() => validateFirefoxProfile('../profile', 'linux'), /absolute local path/);
  assert.equal(validateMarionettePort(2828), 2828);
  assert.throws(() => validateMarionettePort(0), /1 through 65535/);
});

test('launcher delegates to the Native Host without embedding automation credentials', () => {
  const posix = firefoxLauncherContent('/Users/test/.panerelay/bin/host', 'darwin');
  const windows = firefoxLauncherContent('C:\\Users\\test\\.panerelay\\host.cmd', 'win32');
  assert.match(posix, /--launch-firefox/);
  assert.match(windows, /--launch-firefox/);
  assert.doesNotMatch(posix, /MANAGED_TOKEN/);
  assert.doesNotMatch(windows, /MANAGED_TOKEN/);
});

test('managed launch uses only Marionette and an optional validated profile', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-firefox-launch-'));
  const config: FirefoxAutomationRuntimeConfig = {
    firefoxPath: '/Applications/Firefox.app/Contents/MacOS/firefox',
    firefoxProfile: '/Users/test/Firefox',
    geckodriverPath: '/usr/local/bin/geckodriver',
    managedToken: 'managed-token',
    marionettePort: 2828,
    runtimeStatePath: join(directory, 'firefox-runtime.json'),
  };
  let spawnArguments: unknown[] | undefined;
  const child = Object.assign(new EventEmitter(), {
    pid: 4242,
    unref() {},
  });

  try {
    const record = await launchManagedFirefox(config, {
      environment: { PATH: '/usr/bin' },
      spawnProcess: ((...args: unknown[]) => {
        spawnArguments = args;
        return child;
      }) as never,
    });

    assert.deepEqual(firefoxLaunchArguments(config), [
      '--marionette',
      '--profile',
      '/Users/test/Firefox',
    ]);
    assert.equal(spawnArguments?.[0], config.firefoxPath);
    assert.deepEqual(spawnArguments?.[1], firefoxLaunchArguments(config));
    assert.equal(
      (spawnArguments?.[2] as { env: NodeJS.ProcessEnv }).env[PANERELAY_FIREFOX_MANAGED_TOKEN_ENV],
      'managed-token',
    );
    assert.equal(record.pid, 4242);
    assert.equal(
      await isManagedFirefoxEnvironment(config, {
        [PANERELAY_FIREFOX_MANAGED_TOKEN_ENV]: 'managed-token',
      }),
      true,
    );
    assert.equal(
      await isManagedFirefoxEnvironment(config, {
        [PANERELAY_FIREFOX_MANAGED_TOKEN_ENV]: 'wrong-token',
      }),
      false,
    );
    assert.equal(JSON.parse(await readFile(config.runtimeStatePath, 'utf8')).pid, 4242);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
