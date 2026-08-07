import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRawFetchArguments, runFetchCommand } from './fetch-command.js';

const registry = {
  protocol: 'panerelay.fetch-adapter-registry.v1' as const,
  adapters: [
    {
      manifest: {
        protocol: 'panerelay.fetch-adapter.v1' as const,
        id: 'bilibili',
        name: 'Bilibili',
        version: '0.8.0',
        description: 'Authenticated Bilibili commands.',
        entry: 'adapter.mjs',
        commands: [
          {
            name: 'me',
            description: 'Show the current profile.',
            access: 'read' as const,
            args: [],
            output: ['name', 'uid'],
            examples: ['panerelay bilibili me'],
          },
        ],
      },
      executablePath: '/protected/bilibili/0.8.0/adapter.mjs',
      sha256: 'a'.repeat(64),
    },
  ],
};

test('parses raw fetch source headers, repeated query values, body, and browser selection', () => {
  assert.deepEqual(
    parseRawFetchArguments([
      'https://api.example.test/items',
      '--method=post',
      '-H',
      'Origin: https://www.example.test',
      '--header',
      'Referer:',
      '--query',
      'tag:one:two',
      '--query=tag:three',
      '--data',
      '{"ok":true}',
      '--response',
      'json',
      '--no-cookies',
      '--browser',
      'edge',
    ]),
    {
      browserSelector: 'edge',
      request: {
        url: 'https://api.example.test/items',
        method: 'POST',
        headers: { Origin: 'https://www.example.test', Referer: '' },
        query: [
          { name: 'tag', value: 'one:two' },
          { name: 'tag', value: 'three' },
        ],
        body: { encoding: 'utf8', data: '{"ok":true}' },
        responseType: 'json',
        withCookies: false,
      },
    },
  );
  assert.throws(
    () =>
      parseRawFetchArguments(['https://example.test', '--data', 'one', '--data-base64', 'dHdv']),
    /Only one request body/,
  );
});

test('renders global and site help without selecting a browser or spawning an adapter', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  let browserSelections = 0;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const dependencies = {
      readFetchAdapterRegistry: async () => registry,
      selectBrowserFetchRegistration: async () => {
        browserSelections += 1;
        throw new Error('must not select');
      },
    };
    assert.equal(await runFetchCommand(['--help'], { locale: 'en', dependencies }), 0);
    assert.match(
      output.pop() ?? '',
      /panerelay <site> <command>[\s\S]*panerelay fetch <site> <command>[\s\S]*Adapter invocation options:[\s\S]*--json/,
    );
    assert.equal(await runFetchCommand(['bilibili', '--help'], { locale: 'en', dependencies }), 0);
    assert.match(
      output.pop() ?? '',
      /panerelay bilibili <command>[\s\S]*panerelay fetch bilibili <command>[\s\S]*Commands:[\s\S]*me[\s\S]*--json/,
    );
    assert.equal(
      await runFetchCommand(['bilibili', 'me', '--help'], { locale: 'en', dependencies }),
      0,
    );
    assert.match(
      output.pop() ?? '',
      /panerelay bilibili me[\s\S]*panerelay fetch bilibili me[\s\S]*Options:[\s\S]*--json[\s\S]*Output fields:[\s\S]*name, uid/,
    );
    assert.equal(browserSelections, 0);
  } finally {
    console.log = originalLog;
  }
});

test('selects one fetch-capable browser and prints a structured raw result', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  let selectedEnvironment: NodeJS.ProcessEnv | undefined;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    assert.equal(
      await runFetchCommand(['https://example.test', '--browser', 'chrome'], {
        locale: 'en',
        environment: {},
        dependencies: {
          selectBrowserFetchRegistration: async options => {
            selectedEnvironment = options?.environment;
            return {
              source: 'explicit',
              state: {
                protocol: 'panerelay.relay.v2',
                pid: 1,
                port: 41234,
                token: 'secret',
                generation: 'generation',
                browserId: 'browser',
                browserName: 'Chrome',
                capabilities: { cdpRelay: true, browserFetch: true },
                extensionReleaseVersion: '0.8.0',
                extensionBuildVersion: '0.8.0.0',
                hostVersion: '0.8.0',
                extensionId: 'extension',
                updatedAt: new Date().toISOString(),
              },
            };
          },
          runBrowserFetch: async () => ({
            status: 200,
            statusText: 'OK',
            headers: {},
            body: 'ok',
            bodyType: 'text',
            url: 'https://example.test/',
            redirected: false,
            attachedCookieCount: 0,
          }),
        },
      }),
      0,
    );
    assert.equal(selectedEnvironment?.PANERELAY_BROWSER, 'chrome');
    assert.equal(JSON.parse(output[0] ?? '{}').status, 200);
    assert.doesNotMatch(output.join('\n'), /secret/);
  } finally {
    console.log = originalLog;
  }
});

test('renders adapter results as an OpenCLI-style table and supports explicit JSON', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  let releases = 0;
  let now = 1_000;
  const state = {
    protocol: 'panerelay.relay.v2' as const,
    pid: 1,
    port: 41_234,
    token: 'root-secret',
    generation: 'generation',
    browserId: 'browser',
    browserName: 'Chrome',
    capabilities: { cdpRelay: true, browserFetch: true },
    extensionReleaseVersion: '0.8.0',
    extensionBuildVersion: '0.8.0.0',
    hostVersion: '0.8.0',
    extensionId: 'extension',
    updatedAt: new Date().toISOString(),
  };
  const active = {
    state,
    session: {
      protocol: 'panerelay.fetch-session.v1' as const,
      sessionId: 'session',
      endpoint: 'http://127.0.0.1:41234/fetch',
      token: 'fetch-secret',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const dependencies = {
      readFetchAdapterRegistry: async () => registry,
      readFetchAdapterRegistration: async () => registry.adapters[0] ?? null,
      selectBrowserFetchRegistration: async () => ({ source: 'single' as const, state }),
      createBrowserFetchSession: async () => active,
      dispatchFetchAdapter: async () => ({ name: '测试用户', uid: '123' }),
      releaseBrowserFetchSession: async () => {
        releases += 1;
      },
      now: () => {
        const current = now;
        now += 2_700;
        return current;
      },
    };
    assert.equal(await runFetchCommand(['bilibili', 'me'], { locale: 'en', dependencies }), 0);
    assert.match(output[0] ?? '', /┌[─┬]+┐/);
    assert.match(output[0] ?? '', /│ Name\s+│ Uid\s+│/);
    assert.match(output[0] ?? '', /│ 测试用户 │ 123 │/);
    assert.match(output[0] ?? '', /1 items · 2\.7s$/);

    output.length = 0;
    assert.equal(
      await runFetchCommand(['bilibili', 'me', '--json'], { locale: 'en', dependencies }),
      0,
    );
    assert.deepEqual(JSON.parse(output[0] ?? '{}'), { name: '测试用户', uid: '123' });
    assert.equal(releases, 2);
    assert.doesNotMatch(output.join('\n'), /fetch-secret|root-secret/);
  } finally {
    console.log = originalLog;
  }
});
