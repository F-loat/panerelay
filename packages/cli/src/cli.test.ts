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
import type { RunCliConnectionInput } from './command-runner.js';

const state = {
  protocol: 'panerelay.relay.v1' as const,
  pid: 123,
  port: 41_234,
  token: 'secret-token-must-not-print',
  generation: 'generation-123',
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
  assert.deepEqual(
    parseCliArgs([
      '--lang',
      'en',
      'run',
      'browser-use',
      '--mode=extension',
      '--',
      'browser-use',
      '--help',
      '--lang',
      'zh-CN',
    ]),
    {
      adapterId: 'browser-use',
      childCommand: ['browser-use', '--help', '--lang', 'zh-CN'],
      connectionMode: 'extension',
      help: false,
      language: 'en',
      operation: 'run',
    },
  );
  assert.equal(parseCliArgs(['browser', 'clear']).operation, 'browser-clear');
  assert.deepEqual(parseCliArgs(['connection', 'use', 'browser-use', 'extension']), {
    adapterId: 'browser-use',
    connectionMode: 'extension',
    help: false,
    language: undefined,
    operation: 'connection-use',
  });
  assert.deepEqual(
    parseCliArgs([
      'connection',
      'resolve',
      'browser-use',
      '--mode=extension',
      '--browser',
      'chrome',
      '--actor',
      'Browser Use',
      '--session-label=skill-run',
    ]),
    {
      adapterId: 'browser-use',
      actorName: 'Browser Use',
      browserSelector: 'chrome',
      connectionMode: 'extension',
      help: false,
      language: undefined,
      operation: 'connection-resolve',
      sessionLabel: 'skill-run',
    },
  );
  assert.equal(parseCliArgs(['--lang', 'zh-CN', 'browsers']).language, 'zh-CN');
  assert.equal(parseCliArgs(['browsers', '--lang=en']).language, 'en');
  assert.throws(() => parseCliArgs(['browser', 'use']), /BROWSER_SELECTOR_MISSING/);
  assert.throws(() => parseCliArgs(['browser', 'focus']), /Unknown command: browser focus/);
  assert.throws(() => parseCliArgs(['setup']), /Unknown command: setup/);
  assert.throws(() => parseCliArgs(['browsers', '--json']), /Unknown option: --json/);
});

test('passes the exact child command through the run surface', async () => {
  let input: RunCliConnectionInput | undefined;
  assert.equal(
    await main(
      ['run', 'browser-use', '--mode', 'direct', '--', 'browser-use', '--json', '--help'],
      {
        environment: {},
        runCliConnectionCommand: async value => {
          input = value;
          return 23;
        },
      },
    ),
    23,
  );
  assert.deepEqual(input?.childCommand, ['browser-use', '--json', '--help']);
  assert.equal(input?.mode, 'direct');
});

test('saves and resolves engine-neutral connection modes', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  let saved: { adapterId: string; mode: string } | undefined;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(
      await main(['connection', 'use', 'browser-use', 'extension', '--lang', 'en'], {
        environment: {},
        saveCliConnectionMode: async (adapterId, mode) => {
          saved = { adapterId, mode };
        },
      }),
      0,
    );
    assert.deepEqual(saved, { adapterId: 'browser-use', mode: 'extension' });
    assert.match(output.pop() ?? '', /Default browser-use connection mode: extension/);

    assert.equal(
      await main(
        [
          'connection',
          'resolve',
          'browser-use',
          '--mode',
          'extension',
          '--actor',
          'Browser Use',
          '--lang',
          'en',
        ],
        {
          environment: {},
          resolveCliConnection: async input => ({
            adapterId: input.adapterId,
            mode: 'extension',
            connection: {
              kind: 'cdp-http',
              url: 'http://127.0.0.1:41234/cdp/bootstrap/ticket',
            },
            environment: { BU_CDP_URL: 'secret-ticket-url', BU_NAME: 'panerelay' },
            expiresAt: '2026-08-01T02:02:03.000Z',
            concurrencyKey: 'browser-use-lane',
          }),
        },
      ),
      0,
    );
    const resolved = JSON.parse(output.pop() ?? '{}') as Record<string, unknown>;
    assert.deepEqual(resolved.environmentKeys, ['BU_CDP_URL', 'BU_NAME']);
    assert.equal(JSON.stringify(resolved).includes('secret-ticket-url'), false);
  } finally {
    console.log = originalLog;
  }
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
