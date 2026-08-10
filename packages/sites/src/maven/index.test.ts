import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type {
  BrowserFetchRequest,
  BrowserFetchResponse,
  FetchAdapterInvocationRequest,
  SiteCommandDefinition,
} from '@panerelay/site-kit';
import { inspectSite } from '@panerelay/site-kit';
import artifact from './commands/artifact.js';
import search from './commands/search.js';

const COMMANDS: SiteCommandDefinition[] = [artifact, search];
function response(body: unknown, url: string): BrowserFetchResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body,
    bodyType: 'json',
    url,
    redirected: false,
    attachedCookieCount: 0,
  };
}
function context(handler: (request: BrowserFetchRequest) => unknown) {
  const invocation: FetchAdapterInvocationRequest = {
    protocol: 'panerelay.fetch-adapter.v3',
    requestId: 'maven-test',
    operation: 'execute',
    command: 'test',
    args: {},
    fetch: {
      endpoint: 'http://127.0.0.1/fetch',
      token: 'test',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation,
    fetch: async (request: BrowserFetchRequest) => response(handler(request), request.url),
  };
}

test('Maven registers search and artifact commands', async () => {
  const value = await inspectSite(fileURLToPath(new URL('../../src/maven', import.meta.url)));
  assert.deepEqual(
    value.manifest.commands.map(command => command.name).sort(),
    COMMANDS.map(command => command.name).sort(),
  );
});
test('search maps Solr artifact fields', async () => {
  const rows = await search.run(
    context(() => ({
      response: {
        docs: [
          {
            g: 'com.example',
            a: 'demo',
            latestVersion: '1.2.3',
            p: 'jar',
            versionCount: 8,
            timestamp: 1700000000000,
            repositoryId: 'central',
          },
        ],
      },
    })),
    { query: 'demo', limit: 10 },
  );
  assert.deepEqual(rows, [
    {
      rank: 1,
      coordinate: 'com.example:demo',
      groupId: 'com.example',
      artifactId: 'demo',
      latestVersion: '1.2.3',
      packaging: 'jar',
      versions: 8,
      lastPublished: '2023-11-14T22:13:20Z',
      repository: 'central',
      url: 'https://central.sonatype.com/artifact/com.example/demo',
    },
  ]);
});
test('artifact builds coordinate filters and maps versions', async () => {
  let request: BrowserFetchRequest | undefined;
  const rows = await artifact.run(
    context(value => {
      request = value;
      return {
        response: {
          docs: [
            {
              g: 'com.example',
              a: 'demo',
              v: '1.0.0',
              p: 'jar',
              timestamp: 1700000000000,
              tags: ['java', 'library'],
            },
          ],
        },
      };
    }),
    { coordinate: 'com.example:demo', limit: 5 },
  );
  assert.equal(request?.query?.find(item => item.name === 'q')?.value, 'g:com.example AND a:demo');
  assert.deepEqual(rows, [
    {
      groupId: 'com.example',
      artifactId: 'demo',
      version: '1.0.0',
      packaging: 'jar',
      publishedAt: '2023-11-14T22:13:20Z',
      tags: 'java, library',
      url: 'https://central.sonatype.com/artifact/com.example/demo/1.0.0',
    },
  ]);
});
test('Maven validates required inputs before fetching', async () => {
  let calls = 0;
  const ctx = context(() => {
    calls += 1;
    return {};
  });
  await assert.rejects(() => search.run(ctx, { query: ' ' }));
  await assert.rejects(() => artifact.run(ctx, { coordinate: 'bad coordinate' }));
  assert.equal(calls, 0);
});
