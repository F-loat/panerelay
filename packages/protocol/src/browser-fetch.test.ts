import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PANERELAY_FETCH_ADAPTER_PROTOCOL,
  PANERELAY_FETCH_ADAPTER_REGISTRY_PROTOCOL,
  PANERELAY_FETCH_MAX_BODY_BYTES,
  PANERELAY_FETCH_PERMISSION_PROTOCOL,
  PANERELAY_FETCH_SESSION_PROTOCOL,
  areBrowserFetchBindingPoliciesCompatible,
  browserFetchOriginForUrl,
  doesBrowserFetchOriginMatch,
  isBrowserFetchCancelMessage,
  isBrowserFetchPermissionCancelMessage,
  isBrowserFetchBindingPolicy,
  isBrowserFetchPermissionRequest,
  isBrowserFetchPermissionRequestMessage,
  isBrowserFetchPermissionResult,
  isBrowserFetchPermissionResultMessage,
  isBrowserFetchRequest,
  isBrowserFetchResponse,
  isBrowserFetchSessionCreateRequest,
  isBrowserFetchSessionCreated,
  isFetchAdapterInvocationRequest,
  isFetchAdapterInvocationResponse,
  isFetchAdapterManifest,
  isFetchAdapterRegistry,
  isFetchAdapterSourceProvenance,
  normalizeBrowserFetchOriginPattern,
  type BrowserFetchBindingPolicy,
  type FetchAdapterManifest,
} from './browser-fetch.js';
import { PANERELAY_PROTOCOL_VERSION } from './constants.js';

const manifest: FetchAdapterManifest = {
  protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
  id: 'bilibili',
  name: 'Bilibili',
  version: '0.8.0',
  description: 'Authenticated Bilibili fetch commands.',
  origins: ['https://api.bilibili.com'],
  entry: 'adapter.mjs',
  commands: [
    {
      name: 'me',
      description: 'Show the current Bilibili profile.',
      access: 'read',
      args: [],
      output: ['name', 'uid'],
      examples: ['panerelay fetch bilibili me'],
    },
  ],
};

test('validates bounded browser fetch requests and explicit source headers', () => {
  assert.equal(
    isBrowserFetchRequest({
      url: 'https://api.example.com/items',
      method: 'POST',
      headers: { Origin: 'https://example.com', Referer: '' },
      query: [
        { name: 'tag', value: 'one' },
        { name: 'tag', value: 'two' },
      ],
      body: { encoding: 'utf8', data: '{"ok":true}' },
      responseType: 'json',
      timeoutMs: 10_000,
      withCookies: true,
      bindings: ['csrf-form'],
    }),
    true,
  );
  assert.equal(isBrowserFetchRequest({ url: 'file:///tmp/value' }), false);
  assert.equal(
    isBrowserFetchRequest({
      url: 'https://example.com',
      method: 'GET',
      body: { encoding: 'utf8', data: 'not allowed' },
    }),
    false,
  );
  assert.equal(
    isBrowserFetchRequest({
      url: 'https://example.com',
      method: 'POST',
      body: { encoding: 'base64', data: 'a'.repeat(PANERELAY_FETCH_MAX_BODY_BYTES * 2) },
    }),
    false,
  );
  assert.equal(
    isBrowserFetchRequest({ url: 'https://example.com', headers: { Cookie: 'x=1' } }),
    false,
  );
});

test('validates protected binding policies and request compatibility', () => {
  const base = {
    url: 'https://api.example.com/write',
    method: 'POST',
    body: { encoding: 'utf8', data: 'value=one' },
  } as const;
  const headerPolicy: BrowserFetchBindingPolicy = {
    id: 'csrf-header',
    source: { kind: 'cookie', name: 'XSRF-TOKEN', transform: 'url-decode' },
    destination: { kind: 'header', name: 'X-XSRF-TOKEN' },
    requestOrigins: ['https://api.example.com'],
  };
  assert.equal(isBrowserFetchBindingPolicy(headerPolicy), true);
  assert.equal(isBrowserFetchRequest({ ...base, bindings: [headerPolicy.id] }), true);
  assert.equal(
    areBrowserFetchBindingPoliciesCompatible({ ...base, bindings: [headerPolicy.id] }, [
      headerPolicy,
    ]),
    true,
  );
  assert.equal(
    isBrowserFetchBindingPolicy({
      ...headerPolicy,
      destination: { kind: 'header', name: 'Cookie' },
    }),
    false,
  );
  assert.equal(
    areBrowserFetchBindingPoliciesCompatible(
      { ...base, headers: { 'Content-Type': 'application/json' }, bindings: ['csrf-form'] },
      [
        {
          ...headerPolicy,
          id: 'csrf-form',
          destination: { kind: 'form', name: 'csrf' },
        },
      ],
    ),
    false,
  );
  assert.equal(
    areBrowserFetchBindingPoliciesCompatible({ ...base, bindings: ['one', 'two'] }, [
      { ...headerPolicy, id: 'one', destination: { kind: 'form', name: 'csrf' } },
      { ...headerPolicy, id: 'two', destination: { kind: 'json', name: 'csrf' } },
    ]),
    false,
  );
  assert.equal(
    isBrowserFetchRequest({
      ...base,
      bindings: Array.from({ length: 17 }, (_, index) => `csrf-${index}`),
    }),
    false,
  );
  assert.equal(
    isBrowserFetchBindingPolicy({
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
    }),
    true,
  );
});

test('normalizes and matches exact and wildcard fetch origins', () => {
  assert.equal(
    normalizeBrowserFetchOriginPattern('https://api.example.com:443'),
    'https://api.example.com',
  );
  assert.equal(
    normalizeBrowserFetchOriginPattern('https://*.example.com'),
    'https://*.example.com',
  );
  assert.equal(normalizeBrowserFetchOriginPattern('https://example.com/path'), null);
  assert.equal(browserFetchOriginForUrl('https://example.com/path?q=1'), 'https://example.com');
  assert.equal(
    doesBrowserFetchOriginMatch('https://*.example.com', 'https://api.example.com/v1'),
    true,
  );
  assert.equal(
    doesBrowserFetchOriginMatch('https://*.example.com', 'http://api.example.com/v1'),
    false,
  );
});

test('rejects removed user-managed credential bindings', () => {
  assert.equal(
    isBrowserFetchRequest({
      url: 'https://api.example.com/write',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { encoding: 'utf8', data: '{}' },
      redirectMode: 'error',
      credentialBindings: [
        {
          secretName: 'api-token',
          destination: { kind: 'header', name: 'Authorization' },
          transform: 'bearer',
          required: true,
        },
      ],
    }),
    false,
  );
});

test('validates generation-bound fetch session creation', () => {
  assert.equal(
    isBrowserFetchSessionCreateRequest({
      protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
      browser: { browserId: 'browser', generation: 'generation' },
      allowedOrigins: ['https://api.example.com'],
    }),
    true,
  );
  assert.equal(
    isBrowserFetchSessionCreateRequest({
      protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
      browser: { browserId: 'browser', generation: 'generation' },
      allowedOrigins: ['https://api.example.com'],
      token: 'not-accepted',
    }),
    false,
  );
  assert.equal(
    isBrowserFetchSessionCreateRequest({
      protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
      browser: { browserId: 'browser', generation: 'generation' },
      allowedOrigins: ['https://api.example.com'],
      adapterProfile: {
        adapterId: 'example',
        profileName: 'default',
        secrets: [{ name: 'api-token', value: 'secret', origin: 'https://api.example.com' }],
      },
    }),
    false,
  );
  assert.equal(
    isBrowserFetchSessionCreated({
      protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
      sessionId: 'session',
      endpoint: 'http://127.0.0.1:41234/fetch',
      token: 'x'.repeat(32),
      expiresAt: new Date(Date.now() + 1_000).toISOString(),
    }),
    true,
  );
});

test('validates domain fetch permission payloads and correlated messages', () => {
  const request = {
    protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
    browser: { browserId: 'browser', generation: 'generation' },
    domain: 'api.example.com',
  } as const;
  assert.equal(isBrowserFetchPermissionRequest(request), true);
  assert.equal(isBrowserFetchPermissionRequest({ ...request, domain: '*.example.com' }), true);
  assert.equal(
    isBrowserFetchPermissionRequest({ ...request, domain: 'https://api.example.com' }),
    false,
  );
  assert.equal(isBrowserFetchPermissionRequest({ ...request, domain: '*.127.0.0.1' }), false);
  assert.equal(
    isBrowserFetchPermissionRequestMessage({
      type: 'fetch.permission.request',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: 'request',
      browserId: 'browser',
      generation: 'generation',
      domain: request.domain,
    }),
    true,
  );
  assert.equal(
    isBrowserFetchPermissionResultMessage({
      type: 'fetch.permission.result',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId: 'request',
      granted: true,
      domain: request.domain,
      scope: 'domain',
    }),
    true,
  );
  assert.equal(
    isBrowserFetchPermissionResult({
      protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
      granted: true,
      domain: request.domain,
      scope: 'domain',
    }),
    true,
  );
  assert.equal(
    isBrowserFetchPermissionResult({
      protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
      granted: true,
      domain: request.domain,
      scope: 'all-domains',
    }),
    false,
  );
  assert.equal(
    isBrowserFetchPermissionResult({
      protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
      granted: false,
      domain: request.domain,
      scope: 'domain',
    }),
    false,
  );
});

test('validates generation-bound fetch cancellation messages', () => {
  const message = {
    type: 'fetch.cancel',
    protocol: PANERELAY_PROTOCOL_VERSION,
    requestId: 'request',
    browserId: 'browser',
    generation: 'generation',
  } as const;
  assert.equal(isBrowserFetchCancelMessage(message), true);
  assert.equal(isBrowserFetchCancelMessage({ ...message, requestId: '' }), false);
  assert.equal(isBrowserFetchCancelMessage({ ...message, extra: true }), false);

  const permissionMessage = { ...message, type: 'fetch.permission.cancel' } as const;
  assert.equal(isBrowserFetchPermissionCancelMessage(permissionMessage), true);
  assert.equal(
    isBrowserFetchPermissionCancelMessage({ ...permissionMessage, generation: '' }),
    false,
  );
  assert.equal(isBrowserFetchPermissionCancelMessage({ ...permissionMessage, extra: true }), false);
});

test('bounds structured fetch response bodies', () => {
  assert.equal(
    isBrowserFetchResponse({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: { ok: true },
      bodyType: 'json',
      url: 'https://example.com',
      redirected: false,
      attachedCookieCount: 1,
    }),
    true,
  );
  assert.equal(
    isBrowserFetchResponse({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '*'.repeat(PANERELAY_FETCH_MAX_BODY_BYTES * 5),
      bodyType: 'base64',
      url: 'https://example.com',
      redirected: false,
      attachedCookieCount: 0,
    }),
    false,
  );
});

test('validates strict fetch adapter manifests and registries', () => {
  assert.equal(isFetchAdapterManifest(manifest), true);
  assert.equal(isFetchAdapterManifest({ ...manifest, id: '12306' }), true);
  assert.equal(isFetchAdapterManifest({ ...manifest, id: '36kr' }), true);
  assert.equal(isFetchAdapterManifest({ ...manifest, entry: '../adapter.mjs' }), false);
  assert.equal(
    isFetchAdapterManifest({ ...manifest, commands: [...manifest.commands, manifest.commands[0]] }),
    false,
  );
  assert.equal(
    isFetchAdapterRegistry({
      protocol: PANERELAY_FETCH_ADAPTER_REGISTRY_PROTOCOL,
      adapters: [
        {
          manifest,
          executablePath: '/home/user/.panerelay/fetch-adapters/bilibili/adapter.mjs',
          sha256: 'a'.repeat(64),
          source: {
            kind: 'github',
            repository: 'panerelay/sites',
            commit: 'b'.repeat(40),
            ref: 'v1.0.0',
            subdirectory: 'sites/bilibili',
          },
        },
      ],
    }),
    true,
  );
});

test('keeps commands, arguments, and binding identifiers letter-prefixed', () => {
  assert.equal(
    isFetchAdapterManifest({
      ...manifest,
      commands: [{ ...manifest.commands[0], name: '1profile' }],
    }),
    false,
  );
  assert.equal(
    isFetchAdapterManifest({
      ...manifest,
      commands: [
        {
          ...manifest.commands[0],
          args: [
            {
              name: '1user',
              description: 'User identifier.',
              type: 'string',
            },
          ],
        },
      ],
    }),
    false,
  );
  assert.equal(
    isBrowserFetchBindingPolicy({
      id: '1csrf',
      source: { kind: 'cookie', name: 'csrf' },
      destination: { kind: 'header', name: 'X-CSRF-Token' },
      requestOrigins: ['https://example.com'],
    }),
    false,
  );
});

test('rejects removed profile metadata and allows one file argument per command', () => {
  assert.equal(
    isFetchAdapterManifest({
      ...manifest,
      profile: {
        values: [],
        secrets: [],
      },
    }),
    false,
  );
  const fileArgument = {
    name: 'document',
    description: 'Document to upload.',
    type: 'file',
    required: true,
    positional: true,
  } as const;
  assert.equal(
    isFetchAdapterManifest({
      ...manifest,
      commands: [{ ...manifest.commands[0], args: [fileArgument] }],
    }),
    true,
  );
  assert.equal(
    isFetchAdapterManifest({
      ...manifest,
      commands: [
        { ...manifest.commands[0], args: [fileArgument, { ...fileArgument, name: 'other' }] },
      ],
    }),
    false,
  );
});

test('validates backward-compatible adapter source provenance', () => {
  assert.equal(
    isFetchAdapterSourceProvenance({ kind: 'builtin', id: 'bilibili', version: '0.8.0' }),
    true,
  );
  assert.equal(
    isFetchAdapterSourceProvenance({ kind: 'builtin', id: '12306', version: '0.8.0' }),
    true,
  );
  assert.equal(
    isFetchAdapterSourceProvenance({ kind: 'local', path: '/tmp/panerelay/bilibili' }),
    true,
  );
  assert.equal(
    isFetchAdapterSourceProvenance({
      kind: 'github',
      repository: 'owner/repository',
      commit: 'c'.repeat(40),
      ref: 'feature/site-kit',
      subdirectory: 'sites/bilibili',
    }),
    true,
  );
  assert.equal(
    isFetchAdapterSourceProvenance({
      kind: 'github',
      repository: 'https://token@github.com/owner/repository',
      commit: 'c'.repeat(40),
    }),
    false,
  );
  assert.equal(
    isFetchAdapterSourceProvenance({
      kind: 'github',
      repository: 'owner/repository',
      commit: 'c'.repeat(40),
      subdirectory: '../outside',
    }),
    false,
  );
  assert.equal(isFetchAdapterSourceProvenance({ kind: 'local', path: 'relative/adapter' }), false);
});

test('validates correlated one-shot adapter messages', () => {
  const request = {
    protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
    requestId: 'request-1',
    operation: 'execute',
    command: 'me',
    args: {},
    fetch: {
      endpoint: 'http://127.0.0.1:3210/fetch',
      token: 'x'.repeat(32),
      expiresAt: new Date(Date.now() + 1_000).toISOString(),
    },
  };
  assert.equal(isFetchAdapterInvocationRequest(request), true);
  const artifactData = Buffer.from('pdf-bytes').toString('base64');
  assert.equal(
    isFetchAdapterInvocationRequest({
      ...request,
      args: { document: 'artifact_1' },
      artifacts: [
        {
          id: 'artifact_1',
          basename: 'document.pdf',
          mediaType: 'application/pdf',
          size: Buffer.byteLength('pdf-bytes'),
          data: artifactData,
        },
      ],
    }),
    true,
  );
  assert.equal(
    isFetchAdapterInvocationRequest({
      ...request,
      profile: { name: 'default', values: {} },
    }),
    false,
  );
  assert.equal(
    isFetchAdapterInvocationRequest({
      ...request,
      artifacts: [
        {
          id: 'artifact_1',
          basename: '../secret.pdf',
          mediaType: 'application/pdf',
          size: Buffer.byteLength('pdf-bytes'),
          data: artifactData,
        },
      ],
    }),
    false,
  );
  assert.equal(
    isFetchAdapterInvocationRequest({
      ...request,
      fetch: { ...request.fetch, endpoint: 'https://example.com/fetch' },
    }),
    false,
  );
  assert.equal(
    isFetchAdapterInvocationResponse({
      protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
      requestId: 'request-1',
      operation: 'execute',
      success: true,
      result: { uid: '1' },
    }),
    true,
  );
  assert.equal(
    isFetchAdapterInvocationResponse({
      protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
      requestId: 'request-1',
      operation: 'execute',
      success: false,
      error: { code: 'auth-required', message: 'Sign in first.', retryable: false },
    }),
    true,
  );
  assert.equal(
    isFetchAdapterInvocationResponse({
      protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
      requestId: 'request-1',
      operation: 'execute',
      success: false,
      error: 'legacy string error',
    }),
    false,
  );
});
