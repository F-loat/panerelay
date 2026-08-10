import assert from 'node:assert/strict';
import test from 'node:test';
import {
  executeBrowserFetch,
  type BrowserFetchEnvironment,
  type BrowserFetchHeaderOperation,
} from './browser-fetch.js';

function createEnvironment(options?: {
  cookies?: Array<{ name: string; value: string; path?: string }>;
  localStorage?: Record<string, string>;
  response?: Response;
}): BrowserFetchEnvironment & {
  installed: Array<{ url: string; operations: BrowserFetchHeaderOperation[] }>;
  fetches: Array<{ input: string; init: RequestInit }>;
  removed: number[];
} {
  const installed: Array<{ url: string; operations: BrowserFetchHeaderOperation[] }> = [];
  const fetches: Array<{ input: string; init: RequestInit }> = [];
  const removed: number[] = [];
  return {
    installed,
    fetches,
    removed,
    cookiesForUrl: async () => options?.cookies ?? [],
    localStorageForOrigin: async (origin, key) =>
      options?.localStorage?.[`${origin}\n${key}`] ?? null,
    installHeaderRule: async (_ruleId, url, operations) => {
      installed.push({ url, operations });
    },
    removeHeaderRule: async ruleId => {
      removed.push(ruleId);
    },
    fetch: async (input, init) => {
      fetches.push({ input, init });
      return (
        options?.response ??
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    },
  };
}

test('injects browser cookies and preserves explicit source headers without exposing cookies', async () => {
  const environment = createEnvironment({
    cookies: [
      { name: 'root', value: 'one', path: '/' },
      { name: 'deep', value: 'two', path: '/api' },
    ],
  });
  const result = await executeBrowserFetch(
    {
      url: 'https://api.example.test/profile',
      query: [{ name: 'view', value: 'full' }],
      headers: {
        Origin: 'https://www.example.test',
        referer: 'https://www.example.test/account',
        'X-Client': 'panerelay',
      },
      responseType: 'json',
    },
    [],
    environment,
  );

  assert.equal(environment.installed.length, 1);
  assert.equal(environment.installed[0]?.url, 'https://api.example.test/profile?view=full');
  assert.deepEqual(environment.installed[0]?.operations, [
    { header: 'Cookie', operation: 'set', value: 'deep=two; root=one' },
    { header: 'Origin', operation: 'set', value: 'https://www.example.test' },
    { header: 'Referer', operation: 'set', value: 'https://www.example.test/account' },
  ]);
  const requestHeaders = environment.fetches[0]?.init.headers as Headers;
  assert.equal(requestHeaders.get('x-client'), 'panerelay');
  assert.equal(requestHeaders.has('cookie'), false);
  assert.equal(requestHeaders.has('origin'), false);
  assert.equal(result.attachedCookieCount, 2);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(environment.removed.length, 1);
});

test('uses source-header defaults and honors explicit removal without collecting cookies', async () => {
  let cookieReads = 0;
  const environment = createEnvironment();
  environment.cookiesForUrl = async () => {
    cookieReads += 1;
    return [];
  };

  await executeBrowserFetch(
    {
      url: 'https://example.test/value',
      headers: { Referer: '' },
      withCookies: false,
      responseType: 'text',
    },
    [],
    environment,
  );

  assert.equal(cookieReads, 0);
  assert.deepEqual(environment.installed[0]?.operations, [
    { header: 'Cookie', operation: 'remove' },
    { header: 'Origin', operation: 'set', value: 'https://example.test' },
    { header: 'Referer', operation: 'remove' },
  ]);
});

test('always rejects redirects and enables browser Cookie persistence', async () => {
  const environment = createEnvironment();
  await executeBrowserFetch(
    {
      url: 'https://api.example.test/private',
      headers: { Authorization: 'Bearer transient' },
      withCookies: false,
    },
    [],
    environment,
  );
  assert.equal(environment.fetches[0]?.init.redirect, 'error');
  assert.equal(environment.fetches[0]?.init.credentials, 'include');
});

test('aborts the Extension request and removes its header rule when the caller cancels', async () => {
  const environment = createEnvironment();
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => {
    markStarted = resolve;
  });
  environment.fetch = async (_input, init) => {
    markStarted?.();
    return await new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted by test')), {
        once: true,
      });
    });
  };
  const controller = new AbortController();
  const pending = executeBrowserFetch(
    { url: 'https://api.example.test/private' },
    [],
    environment,
    controller.signal,
  );
  await started;
  controller.abort();
  await assert.rejects(pending, /Browser fetch was cancelled/);
  assert.equal(environment.removed.length, 1);
});

test('binds a Cookie into a form field inside the Extension and redacts reflected values', async () => {
  const secret = 'csrf-secret-value';
  const environment = createEnvironment({
    cookies: [
      { name: 'bili_jct', value: secret, path: '/' },
      { name: 'session', value: 'session-value', path: '/' },
    ],
    response: new Response(`{"echo":"${secret}"}`, {
      headers: {
        'content-type': 'application/json',
        'x-reflected-token': secret,
      },
    }),
  });
  const result = await executeBrowserFetch(
    {
      url: 'https://api.example.test/write',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: { encoding: 'utf8', data: 'fid=1&csrf=caller-value' },
      bindings: ['csrf-form'],
      responseType: 'json',
    },
    [
      {
        id: 'csrf-form',
        source: { kind: 'cookie', name: 'bili_jct' },
        destination: { kind: 'form', name: 'csrf' },
        requestOrigins: ['https://api.example.test'],
      },
    ],
    environment,
  );

  assert.equal(environment.fetches[0]?.init.body, `fid=1&csrf=${secret}`);
  assert.equal(environment.fetches[0]?.init.redirect, 'error');
  assert.equal(
    (environment.fetches[0]?.init.headers as Headers).get('content-type'),
    'application/x-www-form-urlencoded',
  );
  assert.deepEqual(result.body, { echo: '[redacted]' });
  assert.equal(result.headers['x-reflected-token'], '[redacted]');
  assert.equal(result.attachedCookieCount, 2);
});

test('supports URL-decoded header bindings without attaching a Cookie header', async () => {
  const environment = createEnvironment({
    cookies: [{ name: 'XSRF-TOKEN', value: 'value%20with%20spaces', path: '/' }],
  });
  const result = await executeBrowserFetch(
    {
      url: 'https://api.example.test/write',
      method: 'POST',
      withCookies: false,
      bindings: ['csrf-header'],
      responseType: 'json',
    },
    [
      {
        id: 'csrf-header',
        source: { kind: 'cookie', name: 'XSRF-TOKEN', transform: 'url-decode' },
        destination: { kind: 'header', name: 'X-XSRF-TOKEN' },
        requestOrigins: ['https://api.example.test'],
      },
    ],
    environment,
  );

  const headers = environment.fetches[0]?.init.headers as Headers;
  assert.equal(headers.get('x-xsrf-token'), 'value with spaces');
  assert.equal(result.attachedCookieCount, 0);
  assert.deepEqual(environment.installed[0]?.operations[0], {
    header: 'Cookie',
    operation: 'remove',
  });
});

test('binds a Cookie into a top-level JSON field and rejects malformed JSON bodies', async () => {
  const environment = createEnvironment({
    cookies: [{ name: 'csrf', value: 'bound-value', path: '/' }],
  });
  await executeBrowserFetch(
    {
      url: 'https://api.example.test/write',
      method: 'POST',
      body: { encoding: 'utf8', data: '{"csrf":"caller","value":1}' },
      bindings: ['csrf-json'],
      responseType: 'json',
    },
    [
      {
        id: 'csrf-json',
        source: { kind: 'cookie', name: 'csrf' },
        destination: { kind: 'json', name: 'csrf' },
        requestOrigins: ['https://api.example.test'],
      },
    ],
    environment,
  );
  assert.deepEqual(JSON.parse(String(environment.fetches[0]?.init.body)), {
    csrf: 'bound-value',
    value: 1,
  });

  const malformed = createEnvironment({
    cookies: [{ name: 'csrf', value: 'bound-value', path: '/' }],
  });
  await assert.rejects(
    executeBrowserFetch(
      {
        url: 'https://api.example.test/write',
        method: 'POST',
        body: { encoding: 'utf8', data: 'not-json' },
        bindings: ['csrf-json'],
      },
      [
        {
          id: 'csrf-json',
          source: { kind: 'cookie', name: 'csrf' },
          destination: { kind: 'json', name: 'csrf' },
          requestOrigins: ['https://api.example.test'],
        },
      ],
      malformed,
    ),
    /JSON body is invalid/,
  );
  assert.equal(malformed.installed.length, 0);
  assert.equal(malformed.fetches.length, 0);
});

test('fails before network work when a required bound Cookie is missing', async () => {
  const environment = createEnvironment();
  await assert.rejects(
    executeBrowserFetch(
      {
        url: 'https://api.example.test/write',
        method: 'POST',
        bindings: ['csrf-form'],
      },
      [
        {
          id: 'csrf-form',
          source: { kind: 'cookie', name: 'csrf' },
          destination: { kind: 'form', name: 'csrf' },
          requestOrigins: ['https://api.example.test'],
        },
      ],
      environment,
    ),
    /Required browser state is missing for binding: csrf-form/,
  );
  assert.equal(environment.installed.length, 0);
  assert.equal(environment.fetches.length, 0);
});

test('redacts a resolved bound value from fetch errors', async () => {
  const environment = createEnvironment({
    cookies: [{ name: 'csrf', value: 'do-not-leak', path: '/' }],
  });
  environment.fetch = async () => {
    throw new Error('transport included do-not-leak');
  };
  await assert.rejects(
    executeBrowserFetch(
      {
        url: 'https://api.example.test/write',
        method: 'POST',
        bindings: ['csrf-form'],
      },
      [
        {
          id: 'csrf-form',
          source: { kind: 'cookie', name: 'csrf' },
          destination: { kind: 'form', name: 'csrf' },
          requestOrigins: ['https://api.example.test'],
        },
      ],
      environment,
    ),
    error =>
      error instanceof Error &&
      error.message.includes('[redacted]') &&
      !error.message.includes('do-not-leak'),
  );
});

test('reads an exact-origin localStorage JSON token and never returns it', async () => {
  const token = 'flomo-token-secret';
  const environment = createEnvironment({
    localStorage: {
      'https://v.flomoapp.com\nme': JSON.stringify({ data: { access_token: token } }),
    },
    response: new Response(JSON.stringify({ reflected: `Bearer ${token}` }), {
      headers: { 'content-type': 'application/json' },
    }),
  });
  const result = await executeBrowserFetch(
    {
      url: 'https://flomoapp.com/api/v1/memo/updated/',
      bindings: ['flomo-token'],
      responseType: 'json',
    },
    [
      {
        id: 'flomo-token',
        source: {
          kind: 'local-storage',
          origin: 'https://v.flomoapp.com',
          key: 'me',
          jsonPointers: ['/access_token', '/data/access_token'],
          trim: true,
        },
        destination: { kind: 'header', name: 'Authorization', prefix: 'Bearer ' },
        requestOrigins: ['https://flomoapp.com'],
      },
    ],
    environment,
  );

  assert.equal(
    (environment.fetches[0]?.init.headers as Headers).get('authorization'),
    `Bearer ${token}`,
  );
  assert.deepEqual(result.body, { reflected: '[redacted]' });
  assert.equal(JSON.stringify(result).includes(token), false);
});

test('rejects short bound values and binary bound responses before disclosure', async () => {
  const policy = {
    id: 'csrf-header',
    source: { kind: 'cookie' as const, name: 'csrf' },
    destination: { kind: 'header' as const, name: 'X-CSRF' },
    requestOrigins: ['https://api.example.test'],
  };
  const short = createEnvironment({ cookies: [{ name: 'csrf', value: 'short' }] });
  await assert.rejects(
    executeBrowserFetch(
      { url: 'https://api.example.test/write', bindings: [policy.id] },
      [policy],
      short,
    ),
    /outside safe binding bounds/,
  );
  assert.equal(short.fetches.length, 0);

  const binary = createEnvironment({
    cookies: [{ name: 'csrf', value: 'long-enough-secret' }],
    response: new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'application/octet-stream' },
    }),
  });
  await assert.rejects(
    executeBrowserFetch(
      { url: 'https://api.example.test/write', bindings: [policy.id] },
      [policy],
      binary,
    ),
    /textual or JSON response/,
  );
});

test('serializes identical URLs while allowing cleanup after a failed request', async () => {
  let concurrent = 0;
  let maximumConcurrent = 0;
  let releaseFirst: (() => void) | undefined;
  let markFirstStarted: (() => void) | undefined;
  const firstGate = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });
  const firstStarted = new Promise<void>(resolve => {
    markFirstStarted = resolve;
  });
  let calls = 0;
  const environment = createEnvironment();
  environment.fetch = async () => {
    calls += 1;
    concurrent += 1;
    maximumConcurrent = Math.max(maximumConcurrent, concurrent);
    if (calls === 1) {
      markFirstStarted?.();
      await firstGate;
    }
    concurrent -= 1;
    return new Response('ok', { headers: { 'content-type': 'text/plain' } });
  };

  const first = executeBrowserFetch({ url: 'https://example.test/same' }, [], environment);
  const second = executeBrowserFetch({ url: 'https://example.test/same' }, [], environment);
  await firstStarted;
  assert.equal(calls, 1);
  releaseFirst?.();
  await Promise.all([first, second]);
  assert.equal(maximumConcurrent, 1);
  assert.equal(environment.removed.length, 2);
});

test('reports Chrome access failures only after attempting header setup', async () => {
  const environment = createEnvironment();
  environment.installHeaderRule = async () => {
    throw new Error('Rule does not have host access');
  };

  await assert.rejects(
    executeBrowserFetch({ url: 'https://private.example.test/value' }, [], environment),
    /grant site access and retry/,
  );
  assert.equal(environment.fetches.length, 0);
});
