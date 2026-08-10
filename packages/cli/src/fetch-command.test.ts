import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseFetchAuthorizationArguments,
  parseRawFetchArguments,
  runFetchCommand,
} from './fetch-command.js';

const registry = {
  protocol: 'panerelay.fetch-adapter-registry.v3' as const,
  adapters: [
    {
      manifest: {
        protocol: 'panerelay.fetch-adapter.v3' as const,
        id: 'bilibili',
        name: 'Bilibili',
        version: '0.8.0',
        description: 'Authenticated Bilibili commands.',
        origins: ['https://api.bilibili.com'],
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

test('normalizes URL, hostname, and wildcard fetch authorization input to domains', () => {
  assert.deepEqual(
    parseFetchAuthorizationArguments([
      '--authorize',
      'https://API.Example.test:8443/private?q=1',
      '--browser=edge',
    ]),
    { domain: 'api.example.test', browserSelector: 'edge' },
  );
  assert.deepEqual(parseFetchAuthorizationArguments(['--authorize=*.Baidu.com']), {
    domain: '*.baidu.com',
  });
  assert.deepEqual(parseFetchAuthorizationArguments(['--authorize=ftp://Files.Example.test/a']), {
    domain: 'files.example.test',
  });
  assert.throws(
    () => parseFetchAuthorizationArguments(['--authorize', '*.127.0.0.1']),
    /hostname|主机名/,
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

test('requests Agent fetch authorization and gives retry guidance after denial', async () => {
  const state = {
    protocol: 'panerelay.relay.v2' as const,
    pid: 1,
    port: 41_234,
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
  };
  const dependencies = {
    readFetchAdapterRegistry: async () => registry,
    selectBrowserFetchRegistration: async () => ({ source: 'single' as const, state }),
    requestBrowserFetchPermission: async () => ({
      protocol: 'panerelay.fetch-permission.v1' as const,
      granted: false,
      domain: '*.baidu.com',
    }),
  };
  await assert.rejects(
    runFetchCommand(['--authorize', '*.baidu.com'], { locale: 'en', dependencies }),
    /denied[\s\S]*panerelay fetch --authorize \*\.baidu\.com/,
  );
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
      protocol: 'panerelay.fetch-session.v3' as const,
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

test('passes migrated site positional arguments through the real fetch command path', async () => {
  const output: string[] = [];
  const originalLog = console.log;
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
      protocol: 'panerelay.fetch-session.v3' as const,
      sessionId: 'session',
      endpoint: 'http://127.0.0.1:41234/fetch',
      token: 'fetch-secret',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
  const migratedRegistry = {
    protocol: 'panerelay.fetch-adapter-registry.v3' as const,
    adapters: [
      {
        manifest: {
          protocol: 'panerelay.fetch-adapter.v3' as const,
          id: 'arxiv',
          name: 'arXiv',
          version: '0.8.0',
          description: 'Public arXiv commands.',
          origins: ['https://export.arxiv.org'],
          entry: 'adapter.mjs',
          commands: [
            {
              name: 'search',
              description: 'Search arXiv papers.',
              access: 'read' as const,
              args: [
                {
                  name: 'query',
                  description: 'Search keyword',
                  type: 'string' as const,
                  required: true,
                  positional: true,
                },
                {
                  name: 'limit',
                  description: 'Maximum results',
                  type: 'number' as const,
                  default: 10,
                },
              ],
              output: ['id', 'title'],
              examples: ['panerelay arxiv search help'],
            },
          ],
        },
        executablePath: '/protected/arxiv/0.8.0/adapter.mjs',
        sha256: 'a'.repeat(64),
      },
      {
        manifest: {
          protocol: 'panerelay.fetch-adapter.v3' as const,
          id: 'hackernews',
          name: 'Hacker News',
          version: '0.8.0',
          description: 'Public Hacker News commands.',
          origins: ['https://hacker-news.firebaseio.com'],
          entry: 'adapter.mjs',
          commands: [
            {
              name: 'top',
              description: 'List top stories.',
              access: 'read' as const,
              args: [
                {
                  name: 'limit',
                  description: 'Number of stories',
                  type: 'number' as const,
                  default: 20,
                },
              ],
              output: ['id'],
              examples: ['panerelay hackernews top --limit 3'],
            },
          ],
        },
        executablePath: '/protected/hackernews/0.8.0/adapter.mjs',
        sha256: 'b'.repeat(64),
      },
    ],
  };
  const calls: Array<{ site: string; command: string; args: Record<string, unknown> }> = [];
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  try {
    const dependencies = {
      readFetchAdapterRegistry: async () => migratedRegistry,
      readFetchAdapterRegistration: async (site: string) =>
        migratedRegistry.adapters.find(adapter => adapter.manifest.id === site) ?? null,
      selectBrowserFetchRegistration: async () => ({ source: 'single' as const, state }),
      createBrowserFetchSession: async () => active,
      releaseBrowserFetchSession: async () => undefined,
      dispatchFetchAdapter: async (
        _registration: unknown,
        _active: unknown,
        command: string,
        args: Record<string, string | number | boolean>,
      ) => {
        calls.push({ site: command === 'search' ? 'arxiv' : 'hackernews', command, args });
        return command === 'search' ? [{ id: '1508.06444', title: 'HELP' }] : [{ id: 1 }];
      },
    };
    assert.equal(
      await runFetchCommand(['arxiv', 'search', 'help', '--json'], { locale: 'en', dependencies }),
      0,
    );
    assert.deepEqual(JSON.parse(output.pop() ?? ''), [{ id: '1508.06444', title: 'HELP' }]);
    assert.equal(
      await runFetchCommand(['hackernews', 'top', '--limit', '3', '--json'], {
        locale: 'en',
        dependencies,
      }),
      0,
    );
    assert.deepEqual(JSON.parse(output.pop() ?? ''), [{ id: 1 }]);
    assert.deepEqual(calls, [
      { site: 'arxiv', command: 'search', args: { query: 'help', limit: 10 } },
      { site: 'hackernews', command: 'top', args: { limit: 3 } },
    ]);
  } finally {
    console.log = originalLog;
  }
});

test('prepares file artifacts before browser selection without exposing local paths', async () => {
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  const manifest = {
    protocol: 'panerelay.fetch-adapter.v3' as const,
    id: 'upload-example',
    name: 'Upload example',
    version: '1.0.0',
    description: 'Artifact fixture.',
    origins: ['https://example.com'],
    entry: 'adapter.mjs',
    commands: [
      {
        name: 'upload',
        description: 'Upload one document.',
        access: 'write' as const,
        args: [
          {
            name: 'document',
            description: 'Document.',
            type: 'file' as const,
            required: true,
            positional: true,
          },
        ],
        output: ['ok'],
        examples: ['panerelay upload-example upload document.pdf'],
      },
    ],
  };
  const registration = {
    manifest,
    executablePath: '/protected/upload-example/1.0.0/adapter.mjs',
    sha256: 'c'.repeat(64),
  };
  const uploadRegistry = {
    protocol: 'panerelay.fetch-adapter-registry.v3' as const,
    adapters: [registration],
  };
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
      protocol: 'panerelay.fetch-session.v3' as const,
      sessionId: 'session',
      endpoint: 'http://127.0.0.1:41234/fetch',
      token: 'fetch-secret',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
  const sequence: string[] = [];
  let dispatchArgs: unknown;
  let dispatchOptions: unknown;
  try {
    assert.equal(
      await runFetchCommand(['upload-example', 'upload', '/local/document.pdf', '--json'], {
        locale: 'en',
        dependencies: {
          readFetchAdapterRegistry: async () => uploadRegistry,
          readFetchAdapterRegistration: async () => registration,
          prepareFetchAdapterArtifacts: async (_command, args) => {
            sequence.push('artifact');
            assert.equal(args.document, '/local/document.pdf');
            return {
              args: { document: 'artifact-1' },
              artifacts: [
                {
                  id: 'artifact-1',
                  basename: 'document.pdf',
                  mediaType: 'application/pdf',
                  size: 4,
                  data: 'JVBERg==',
                },
              ],
            };
          },
          selectBrowserFetchRegistration: async () => {
            sequence.push('browser');
            return { source: 'single' as const, state };
          },
          createBrowserFetchSession: async () => {
            sequence.push('session');
            return active;
          },
          dispatchFetchAdapter: async (_registration, _active, _command, args, options) => {
            sequence.push('dispatch');
            dispatchArgs = args;
            dispatchOptions = options;
            return { ok: true };
          },
          releaseBrowserFetchSession: async () => {
            sequence.push('release');
          },
        },
      }),
      0,
    );
    assert.deepEqual(sequence, ['artifact', 'browser', 'session', 'dispatch', 'release']);
    assert.deepEqual(dispatchArgs, { document: 'artifact-1' });
    assert.equal(JSON.stringify(dispatchOptions).includes('/local/document.pdf'), false);
    assert.deepEqual(JSON.parse(output[0] ?? '{}'), { ok: true });
    assert.doesNotMatch(output.join('\n'), /root-secret|fetch-secret/);
  } finally {
    console.log = originalLog;
  }
});

test('rejects the removed --profile option before file access or browser selection', async () => {
  let prepared = false;
  let selected = false;
  await assert.rejects(
    runFetchCommand(['bilibili', 'me', '--profile', 'work'], {
      locale: 'en',
      dependencies: {
        readFetchAdapterRegistry: async () => registry,
        readFetchAdapterRegistration: async () => registry.adapters[0] ?? null,
        prepareFetchAdapterArtifacts: async (_command, args) => {
          prepared = true;
          return { args };
        },
        selectBrowserFetchRegistration: async () => {
          selected = true;
          throw new Error('must not select');
        },
      },
    }),
    /Unknown adapter option: --profile/,
  );
  assert.equal(prepared, false);
  assert.equal(selected, false);
});
