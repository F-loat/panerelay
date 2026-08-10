import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import {
  SiteError,
  createMultipartBody,
  decodeBase64Text,
  fetchValidatedJson,
  seedSameOriginPage,
} from './helpers.js';
import { defineCommand, type SiteCommandContext } from './definitions.js';
import { executeSiteCommand, runSiteAdapter } from './runtime.js';

function context(fetch: SiteCommandContext['fetch']): SiteCommandContext {
  return {
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3',
      requestId: 'request',
      operation: 'execute',
      command: 'fixture',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1:41234/fetch',
        token: 'x'.repeat(32),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch,
    artifact: () => {
      throw new SiteError('invalid-input', 'No artifact');
    },
  };
}

test('decodes Base64 GBK bytes and validates JSON/authentication responses', async () => {
  assert.equal(decodeBase64Text('1tDOxA==', 'gbk'), '中文');
  await assert.rejects(
    fetchValidatedJson(
      context(async () => ({
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        body: { error: 'login' },
        bodyType: 'json',
        url: 'https://example.test/private',
        redirected: false,
        attachedCookieCount: 0,
      })),
      { url: 'https://example.test/private' },
    ),
    error => error instanceof SiteError && error.code === 'auth-required',
  );
});

test('seeds one same-origin page while preserving explicit source headers', async () => {
  let request: unknown;
  const fixture = context(async value => {
    request = value;
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: 'ok',
      bodyType: 'text',
      url: value.url,
      redirected: false,
      attachedCookieCount: 1,
    };
  });
  await seedSameOriginPage(fixture, 'https://example.test/page', {
    headers: { Origin: 'https://example.test', Referer: 'https://example.test/home' },
  });
  assert.deepEqual(request, {
    url: 'https://example.test/page',
    method: 'GET',
    headers: { Origin: 'https://example.test', Referer: 'https://example.test/home' },
    responseType: 'text',
    withCookies: true,
  });
  await assert.rejects(
    seedSameOriginPage(fixture, 'https://example.test/page', {
      headers: { Referer: 'https://other.test/' },
    }),
    error => error instanceof SiteError && error.code === 'invalid-input',
  );
});

test('retrieves invocation artifacts and constructs one bounded multipart body', async () => {
  const command = defineCommand({
    name: 'upload',
    description: 'Upload.',
    access: 'write',
    args: [
      {
        name: 'document',
        description: 'Document.',
        type: 'file',
        required: true,
        positional: true,
      },
    ],
    output: ['contentType', 'body'],
    examples: ['panerelay fixture upload document.pdf'],
    async run(siteContext) {
      const artifact = siteContext.artifact('document');
      return createMultipartBody('file', artifact, [{ name: 'title', value: 'Fixture' }]);
    },
  });
  const bytes = Buffer.from('%PDF fixture');
  const result = (await executeSiteCommand(
    [command],
    {
      protocol: 'panerelay.fetch-adapter.v3',
      requestId: 'request',
      operation: 'execute',
      command: 'upload',
      args: { document: 'artifact_1' },
      artifacts: [
        {
          id: 'artifact_1',
          basename: 'document.pdf',
          mediaType: 'application/pdf',
          size: bytes.length,
          data: bytes.toString('base64'),
        },
      ],
      fetch: {
        endpoint: 'http://127.0.0.1:41234/fetch',
        token: 'x'.repeat(32),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    { browserFetch: async () => assert.fail('multipart construction must not fetch') },
  )) as ReturnType<typeof createMultipartBody>;
  assert.match(result.contentType, /^multipart\/form-data; boundary=/);
  const body = Buffer.from(result.body.data, 'base64').toString('utf8');
  assert.match(body, /name="title"\r\n\r\nFixture/);
  assert.match(body, /filename="document\.pdf"/);
  assert.match(body, /%PDF fixture/);
  assert.throws(
    () =>
      createMultipartBody(
        'file',
        {
          id: 'artifact',
          basename: 'x.txt',
          mediaType: 'text/plain',
          size: 1,
          bytes: Uint8Array.of(120),
        },
        [{ name: 'file', value: 'duplicate' }],
      ),
    error => error instanceof SiteError && error.code === 'invalid-input',
  );
});

test('serializes typed failures and hides ordinary error details', async () => {
  const typed = defineCommand({
    name: 'typed',
    description: 'Typed failure.',
    access: 'read',
    args: [],
    output: [],
    examples: ['panerelay fixture typed'],
    async run() {
      throw new SiteError('challenge-required', 'Complete the upstream challenge', true);
    },
  });
  const ordinary = defineCommand({
    ...typed,
    name: 'ordinary',
    async run() {
      throw new Error('local path /private/file and bytes must not escape');
    },
  });
  const invoke = async (command: string): Promise<Record<string, unknown>> => {
    const invocation = JSON.stringify({
      protocol: 'panerelay.fetch-adapter.v3',
      requestId: 'request',
      operation: 'execute',
      command,
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1:41234/fetch',
        token: 'x'.repeat(32),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    let output = '';
    await runSiteAdapter(
      [typed, ordinary],
      Readable.from([invocation]),
      new Writable({
        write(chunk, _encoding, callback) {
          output += String(chunk);
          callback();
        },
      }),
    );
    return JSON.parse(output) as Record<string, unknown>;
  };
  assert.deepEqual((await invoke('typed')).error, {
    code: 'challenge-required',
    message: 'Complete the upstream challenge',
    retryable: true,
  });
  assert.deepEqual((await invoke('ordinary')).error, {
    code: 'command-failed',
    message: 'Site command failed',
  });
});

test('classifies sanitized Bridge failures without exposing relay diagnostics', async testContext => {
  const command = defineCommand({
    name: 'fetch',
    description: 'Fetch through the relay.',
    access: 'read',
    args: [],
    output: [],
    examples: ['panerelay fixture fetch'],
    async run(context) {
      return context.fetch({ url: 'https://example.test/private' });
    },
  });
  const invoke = async (status: number, error: string): Promise<Record<string, unknown>> => {
    testContext.mock.method(globalThis, 'fetch', async () => Response.json({ error }, { status }));
    const invocation = JSON.stringify({
      protocol: 'panerelay.fetch-adapter.v3',
      requestId: 'request',
      operation: 'execute',
      command: 'fetch',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1:41234/fetch',
        token: 'x'.repeat(32),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    let output = '';
    await runSiteAdapter(
      [command],
      Readable.from([invocation]),
      new Writable({
        write(chunk, _encoding, callback) {
          output += String(chunk);
          callback();
        },
      }),
    );
    testContext.mock.restoreAll();
    return JSON.parse(output) as Record<string, unknown>;
  };

  assert.deepEqual(
    (await invoke(502, 'No open browser tab matches localStorage origin: https://example.test'))
      .error,
    {
      code: 'missing-credential',
      message: 'Required browser localStorage state is unavailable',
    },
  );
  assert.deepEqual((await invoke(502, 'private upstream detail timed out')).error, {
    code: 'upstream-failure',
    message: 'Browser-backed request timed out',
    retryable: true,
  });
});
