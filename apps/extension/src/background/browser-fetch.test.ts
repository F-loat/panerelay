import assert from 'node:assert/strict';
import test from 'node:test';
import {
  executeBrowserFetch,
  type BrowserFetchEnvironment,
  type BrowserFetchHeaderOperation,
} from './browser-fetch.js';

function createEnvironment(options?: {
  cookies?: Array<{ name: string; value: string; path?: string }>;
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
    environment,
  );

  assert.equal(cookieReads, 0);
  assert.deepEqual(environment.installed[0]?.operations, [
    { header: 'Cookie', operation: 'remove' },
    { header: 'Origin', operation: 'set', value: 'https://example.test' },
    { header: 'Referer', operation: 'remove' },
  ]);
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
      cookieBindings: [
        {
          cookieName: 'bili_jct',
          destination: { kind: 'form', name: 'csrf' },
        },
      ],
      responseType: 'json',
    },
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
      cookieBindings: [
        {
          cookieName: 'XSRF-TOKEN',
          destination: { kind: 'header', name: 'X-XSRF-TOKEN' },
          transform: 'url-decode',
        },
      ],
      responseType: 'json',
    },
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
      cookieBindings: [{ cookieName: 'csrf', destination: { kind: 'json', name: 'csrf' } }],
      responseType: 'json',
    },
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
        cookieBindings: [{ cookieName: 'csrf', destination: { kind: 'json', name: 'csrf' } }],
      },
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
        cookieBindings: [{ cookieName: 'csrf', destination: { kind: 'form', name: 'csrf' } }],
      },
      environment,
    ),
    /Required browser Cookie is missing: csrf/,
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
        cookieBindings: [{ cookieName: 'csrf', destination: { kind: 'form', name: 'csrf' } }],
      },
      environment,
    ),
    error =>
      error instanceof Error &&
      error.message.includes('[redacted]') &&
      !error.message.includes('do-not-leak'),
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

  const first = executeBrowserFetch({ url: 'https://example.test/same' }, environment);
  const second = executeBrowserFetch({ url: 'https://example.test/same' }, environment);
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
    executeBrowserFetch({ url: 'https://private.example.test/value' }, environment),
    /grant site access and retry/,
  );
  assert.equal(environment.fetches.length, 0);
});
