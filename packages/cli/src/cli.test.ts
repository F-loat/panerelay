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
  protocol: 'panerelay.relay.v2' as const,
  pid: 123,
  port: 41_234,
  token: 'secret-token-must-not-print',
  generation: 'generation-123',
  browserId: 'edge-browser-id',
  browserName: 'Microsoft Edge',
  browserFamily: 'edge' as const,
  capabilities: { cdpRelay: true },
  extensionReleaseVersion: '0.2.0',
  extensionBuildVersion: '0.2.0.0',
  hostVersion: '0.2.0',
  extensionId: 'panplnkjlkoceaonlmpdekjphgmbggmi',
  updatedAt: '2026-07-31T08:00:00.000Z',
};

function fetchRegistry(id = 'bilibili') {
  return {
    protocol: 'panerelay.fetch-adapter-registry.v3' as const,
    adapters: [
      {
        manifest: {
          protocol: 'panerelay.fetch-adapter.v3' as const,
          id,
          name: id,
          version: '0.8.0',
          description: `${id} commands`,
          origins: ['https://example.com'],
          entry: 'adapter.mjs',
          commands: [
            {
              name: 'me',
              description: 'Show the current profile.',
              access: 'read' as const,
              args: [],
              output: ['name'],
              examples: [`panerelay ${id} me`],
            },
          ],
        },
        executablePath: `/protected/${id}/0.8.0/adapter.mjs`,
        sha256: 'a'.repeat(64),
      },
    ],
  };
}

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
  assert.deepEqual(parseCliArgs(['fetch', 'bilibili', '--help']), {
    fetchArguments: ['bilibili', '--help'],
    help: false,
    language: undefined,
    operation: 'fetch',
  });
  assert.deepEqual(parseCliArgs(['connection', 'use', 'browser-use', 'extension']), {
    adapterId: 'browser-use',
    connectionMode: 'extension',
    help: false,
    language: undefined,
    operation: 'connection-use',
  });
  assert.equal(parseCliArgs(['--lang', 'zh-CN', 'browsers']).language, 'zh-CN');
  assert.equal(parseCliArgs(['browsers', '--lang=en']).language, 'en');
  assert.throws(() => parseCliArgs(['browser', 'use']), /BROWSER_SELECTOR_MISSING/);
  assert.throws(() => parseCliArgs(['browser', 'clear']), /Unknown command: browser clear/);
  assert.throws(
    () => parseCliArgs(['connection', 'resolve', 'browser-use']),
    /Unknown command: connection resolve/,
  );
  assert.throws(() => parseCliArgs(['run', 'browser-use']), /Unknown command: run/);
  assert.throws(() => parseCliArgs(['browser', 'focus']), /Unknown command: browser focus/);
  assert.throws(() => parseCliArgs(['setup']), /Unknown command: setup/);
  assert.throws(() => parseCliArgs(['browsers', '--json']), /Unknown option: --json/);
});

test('keeps top-level help focused on setup and common workflows', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(await main([], { environment: {}, systemLocale: 'en-US' }), 0);
    assert.equal(await main(['--lang', 'zh-CN', '--help'], { environment: {} }), 0);
  } finally {
    console.log = originalLog;
  }

  const help = output.join('\n');
  assert.match(help, /Setup and site adapters:/);
  assert.match(help, /安装与站点适配器：/);
  assert.match(help, /@panerelay\/setup add <adapter>/);
  assert.match(help, /@panerelay\/setup add <适配器>/);
  assert.doesNotMatch(help, /panerelay browser clear/);
  assert.doesNotMatch(help, /panerelay connection resolve/);
  assert.doesNotMatch(help, /panerelay run/);
  assert.doesNotMatch(help, /@panerelay\/cli browsers/);
});

test('rejects removed commands without changing browser or integration state', async () => {
  const errors: string[] = [];
  const originalError = console.error;
  const originalLog = console.log;
  let sideEffect = false;
  console.error = (...values: unknown[]) => errors.push(values.join(' '));
  console.log = () => undefined;
  try {
    const dependencies = {
      environment: {},
      readFetchAdapterRegistry: async () => ({
        protocol: 'panerelay.fetch-adapter-registry.v3' as const,
        adapters: [],
      }),
      runFetchCommand: async () => {
        sideEffect = true;
        return 0;
      },
      saveCliConnectionMode: async () => {
        sideEffect = true;
      },
      selectBrowserRegistration: async () => {
        sideEffect = true;
        return { source: 'explicit' as const, state };
      },
      setBrowserDefault: async () => {
        sideEffect = true;
        return {
          protocol: 'panerelay.relay.v2' as const,
          browserId: state.browserId,
          updatedAt: state.updatedAt,
        };
      },
      systemLocale: 'en-US',
    };

    assert.equal(await main(['browser', 'clear'], dependencies), 2);
    assert.equal(await main(['connection', 'resolve', 'browser-use'], dependencies), 2);
    assert.equal(await main(['run', 'browser-use', '--', 'browser-use'], dependencies), 2);
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }

  assert.equal(sideEffect, false);
  assert.match(errors.join('\n'), /Unknown command: browser clear/);
  assert.match(errors.join('\n'), /Unknown command: connection resolve/);
  assert.match(errors.join('\n'), /Unknown command: run/);
});

test('routes fetch help through the fetch command without requiring a browser', async () => {
  let invocation: { argv: string[]; locale: string } | undefined;
  assert.equal(
    await main(['fetch', 'bilibili', '--help', '--lang', 'zh-CN'], {
      environment: {},
      runFetchCommand: async (argv, options) => {
        invocation = { argv, locale: options.locale };
        return 0;
      },
    }),
    0,
  );
  assert.deepEqual(invocation, { argv: ['bilibili', '--help'], locale: 'zh-CN' });
});

test('routes exact installed site aliases while preserving top-level precedence and arguments', async () => {
  const invocations: Array<{ argv: string[]; locale: string }> = [];
  const output: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  console.error = (...values: unknown[]) => errors.push(values.join(' '));
  try {
    const dependencies = {
      environment: { LANG: 'en_US.UTF-8' },
      readFetchAdapterRegistry: async () => fetchRegistry(),
      runFetchCommand: async (argv: string[], options: { locale: string }) => {
        invocations.push({ argv, locale: options.locale });
        return 0;
      },
      systemLocale: 'en-US',
    };
    assert.equal(
      await main(['bilibili', 'subtitle', 'BV1test', '--lang', 'zh-CN'], dependencies),
      0,
    );
    assert.equal(await main(['--lang', 'zh-CN', 'bilibili', 'me', '--json'], dependencies), 0);
    assert.equal(await main(['bilibili', '--help'], dependencies), 0);
    assert.equal(await main(['fetch', 'bilibili', 'me'], dependencies), 0);
    assert.deepEqual(invocations, [
      {
        argv: ['bilibili', 'subtitle', 'BV1test', '--lang', 'zh-CN'],
        locale: 'en',
      },
      { argv: ['bilibili', 'me', '--json'], locale: 'zh-CN' },
      { argv: ['bilibili', '--help'], locale: 'en' },
      { argv: ['bilibili', 'me'], locale: 'en' },
    ]);

    let aliasReads = 0;
    assert.equal(
      await main(['browsers'], {
        environment: {},
        listBrowserRegistrations: async () => [],
        readBrowserDefault: async () => null,
        readFetchAdapterRegistry: async () => {
          aliasReads += 1;
          return fetchRegistry('browsers');
        },
      }),
      0,
    );
    assert.equal(aliasReads, 0);

    let unexpectedFetch = false;
    const unknownDependencies = {
      environment: {},
      readFetchAdapterRegistry: async () => fetchRegistry(),
      runFetchCommand: async () => {
        unexpectedFetch = true;
        return 0;
      },
      systemLocale: 'en-US',
    };
    assert.equal(await main(['setup'], unknownDependencies), 2);
    assert.equal(await main(['https://example.test'], unknownDependencies), 2);
    assert.equal(unexpectedFetch, false);
    assert.match(errors.join('\n'), /Unknown command: setup/);
    assert.match(errors.join('\n'), /Unknown command: https:\/\/example\.test/);

    assert.equal(
      await main(['bilibili', 'me'], {
        environment: {},
        readFetchAdapterRegistry: async () => {
          throw new Error('Fetch adapter registry permissions must be 0600');
        },
        runFetchCommand: async () => {
          unexpectedFetch = true;
          return 0;
        },
      }),
      1,
    );
    assert.equal(unexpectedFetch, false);
    assert.match(errors.join('\n'), /permissions must be 0600/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test('preserves manifest command --lang while global --lang still selects the CLI locale', async () => {
  let invocation: { argv: string[]; locale: string } | undefined;
  assert.equal(
    await main(['fetch', 'bilibili', 'subtitle', 'BV1test', '--lang', 'zh-CN'], {
      environment: { LANG: 'en_US.UTF-8' },
      systemLocale: 'en-US',
      runFetchCommand: async (argv, options) => {
        invocation = { argv, locale: options.locale };
        return 0;
      },
    }),
    0,
  );
  assert.deepEqual(invocation, {
    argv: ['bilibili', 'subtitle', 'BV1test', '--lang', 'zh-CN'],
    locale: 'en',
  });

  invocation = undefined;
  assert.equal(
    await main(['--lang', 'zh-CN', 'fetch', 'bilibili', 'subtitle', 'BV1test', '--lang', 'en-US'], {
      environment: { LANG: 'en_US.UTF-8' },
      systemLocale: 'en-US',
      runFetchCommand: async (argv, options) => {
        invocation = { argv, locale: options.locale };
        return 0;
      },
    }),
    0,
  );
  assert.deepEqual(invocation, {
    argv: ['bilibili', 'subtitle', 'BV1test', '--lang', 'en-US'],
    locale: 'zh-CN',
  });
});

test('preserves a site command --version option instead of printing the CLI version', async () => {
  let invocation: string[] | undefined;
  assert.equal(
    await main(['fetch', 'osv', 'query', 'lodash', '--version', '4.17.20'], {
      environment: {},
      runFetchCommand: async argv => {
        invocation = argv;
        return 0;
      },
    }),
    0,
  );
  assert.deepEqual(invocation, ['osv', 'query', 'lodash', '--version', '4.17.20']);
});

test('saves engine-neutral connection modes', async () => {
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
  } finally {
    console.log = originalLog;
  }
});

test('lists bounded browser metadata and manages the saved default', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  let selectedEnvironment: NodeJS.ProcessEnv | undefined;
  let savedBrowserId: string | undefined;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(
      await main(['browsers', '--lang', 'en'], {
        environment: {},
        listBrowserRegistrations: async () => [{ state, ready: true }],
        readBrowserDefault: async () => ({
          protocol: 'panerelay.relay.v2',
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
          protocol: 'panerelay.relay.v2',
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
            protocol: 'panerelay.relay.v2',
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
    assert.match(output.join('\n'), /常用用法：[\s\S]*panerelay <站点> <命令>/);

    output.length = 0;
    assert.equal(
      await main(['setup', '--lang', 'en'], {
        environment: {},
        readFetchAdapterRegistry: async () => ({
          protocol: 'panerelay.fetch-adapter-registry.v3',
          adapters: [],
        }),
        systemLocale: 'zh-CN',
      }),
      2,
    );
    assert.match(errors.join('\n'), /Unknown command: setup/);
    assert.match(output.join('\n'), /Common usage:/);
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
