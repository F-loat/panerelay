import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PANERELAY_BROWSER_DEFAULT_PATH_ENV,
  PANERELAY_BROWSER_ID_ENV,
  PANERELAY_BROWSER_REGISTRY_PATH_ENV,
} from '@panerelay/browser-registry';
import { main, parseCliArgs } from './cli.js';

const state = {
  protocol: 'panerelay.relay.v1' as const,
  pid: 123,
  port: 41_234,
  token: 'secret-token-must-not-print',
  browserId: 'edge-browser-id',
  browserName: 'Microsoft Edge',
  browserFamily: 'edge' as const,
  capabilities: { cdpRelay: true },
  extensionVersion: '0.2.0',
  extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
  updatedAt: '2026-07-31T08:00:00.000Z',
};

test('parses browser administration commands and localized options', () => {
  assert.deepEqual(parseCliArgs([]), { help: true, language: undefined });
  assert.equal(parseCliArgs(['browsers']).operation, 'browsers');
  assert.deepEqual(
    {
      operation: parseCliArgs(['browser', 'use', 'edge']).operation,
      selector: parseCliArgs(['browser', 'use', 'edge']).browserSelector,
    },
    { operation: 'browser-use', selector: 'edge' },
  );
  assert.equal(parseCliArgs(['browser', 'clear']).operation, 'browser-clear');
  assert.equal(parseCliArgs(['--lang', 'zh-CN', 'browsers']).language, 'zh-CN');
  assert.equal(parseCliArgs(['browsers', '--lang=en']).language, 'en');
  assert.throws(() => parseCliArgs(['browser', 'use']), /BROWSER_SELECTOR_MISSING/);
  assert.throws(() => parseCliArgs(['browser', 'focus']), /Unknown command: browser focus/);
  assert.throws(() => parseCliArgs(['setup']), /Unknown command: setup/);
  assert.throws(() => parseCliArgs(['browsers', '--json']), /Unknown option: --json/);
});

test('lists bounded browser metadata and manages the saved default', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  let selectedEnvironment: NodeJS.ProcessEnv | undefined;
  let savedBrowserId: string | undefined;
  let cleared = false;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(
      await main(['browsers', '--lang', 'en'], {
        environment: {},
        listBrowserRegistrations: async () => [{ state, ready: true }],
        readBrowserDefault: async () => ({
          protocol: 'panerelay.relay.v1',
          browserId: state.browserId,
          updatedAt: state.updatedAt,
        }),
      }),
      0,
    );
    assert.match(output.join('\n'), /Microsoft Edge \(edge, ready, default\)/);
    assert.match(output.join('\n'), /edge-browser-id/);
    assert.doesNotMatch(output.join('\n'), /secret-token/);

    output.length = 0;
    assert.equal(
      await main(['browsers', '--lang', 'zh-CN'], {
        environment: {},
        listBrowserRegistrations: async () => [],
        readBrowserDefault: async () => ({
          protocol: 'panerelay.relay.v1',
          browserId: 'offline-browser-id',
          updatedAt: state.updatedAt,
        }),
      }),
      0,
    );
    assert.match(output.join('\n'), /保存的默认浏览器当前不可用：offline-browser-id/);

    output.length = 0;
    assert.equal(
      await main(['browser', 'use', 'edge', '--lang', 'en'], {
        environment: { [PANERELAY_BROWSER_ID_ENV]: 'ambient-browser-id' },
        selectBrowserRegistration: async options => {
          selectedEnvironment = options?.environment;
          return { source: 'explicit', state };
        },
        setBrowserDefault: async browserId => {
          savedBrowserId = browserId;
          return {
            protocol: 'panerelay.relay.v1',
            browserId,
            updatedAt: state.updatedAt,
          };
        },
      }),
      0,
    );
    assert.equal(selectedEnvironment?.[PANERELAY_BROWSER_ID_ENV], undefined);
    assert.equal(selectedEnvironment?.PANERELAY_BROWSER, 'edge');
    assert.equal(savedBrowserId, 'edge-browser-id');
    assert.match(output.join('\n'), /Default browser: Microsoft Edge \(edge-browser-id\)/);

    output.length = 0;
    assert.equal(
      await main(['browser', 'clear', '--lang', 'zh-CN'], {
        clearBrowserDefault: async () => {
          cleared = true;
          return null;
        },
        environment: {},
      }),
      0,
    );
    assert.equal(cleared, true);
    assert.match(output.join('\n'), /已清除保存的默认浏览器/);
  } finally {
    console.log = originalLog;
  }
});

test('localizes help and argument errors', async () => {
  const output: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  console.error = (...values: unknown[]) => errors.push(values.join(' '));
  try {
    assert.equal(await main(['--help'], { environment: {}, systemLocale: 'zh-CN' }), 0);
    assert.match(output.join('\n'), /用法：/);

    output.length = 0;
    assert.equal(
      await main(['setup', '--lang', 'en'], {
        environment: {},
        systemLocale: 'zh-CN',
      }),
      2,
    );
    assert.match(errors.join('\n'), /Unknown command: setup/);
    assert.match(output.join('\n'), /Usage:/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test('returns a failure without leaking registry details', async () => {
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...values: unknown[]) => errors.push(values.join(' '));
  try {
    assert.equal(
      await main(['browsers', '--lang', 'en'], {
        environment: {},
        listBrowserRegistrations: async () => {
          throw new Error('registry unavailable');
        },
      }),
      1,
    );
    assert.deepEqual(errors, ['registry unavailable']);
  } finally {
    console.error = originalError;
  }
});

test('the built executable supports package-runner-style invocation', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'panerelay-cli-test-'));
  try {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./cli.js', import.meta.url)), 'browsers', '--lang', 'en'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          [PANERELAY_BROWSER_DEFAULT_PATH_ENV]: join(fixture, 'default.json'),
          [PANERELAY_BROWSER_REGISTRY_PATH_ENV]: join(fixture, 'browsers'),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Panerelay browsers/);
    assert.match(result.stdout, /No live Panerelay browsers are registered/);
  } finally {
    rmSync(fixture, { force: true, recursive: true });
  }
});
