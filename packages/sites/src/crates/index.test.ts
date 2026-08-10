import assert from 'node:assert/strict';
import test from 'node:test';
import crate from './commands/crate.js';
import search from './commands/search.js';

function context(requests: string[]) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'crates-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: Array<{ name: string; value: string }> }) => {
      requests.push(request.url);
      const body = request.url.endsWith('/crates')
        ? {
            crates: [
              {
                name: 'serde',
                newest_version: '1.0.0',
                description: 'Serialization',
                downloads: 10,
                recent_downloads: 2,
                repository: 'https://github.com/serde-rs/serde',
                updated_at: '2024-01-02T00:00:00Z',
              },
            ],
          }
        : {
            crate: {
              id: 'serde',
              name: 'serde',
              newest_version: '1.0.0',
              description: 'Serialization',
              downloads: 10,
              recent_downloads: 2,
              num_versions: 30,
              homepage: 'https://serde.rs',
              documentation: 'https://docs.rs/serde',
              repository: 'https://github.com/serde-rs/serde',
              created_at: '2015-01-01T00:00:00Z',
              updated_at: '2024-01-02T00:00:00Z',
            },
            versions: [{ num: '1.0.0', license: 'MIT' }],
            keywords: [{ keyword: 'serde' }],
            categories: [{ category: 'data-structures' }],
          };
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body,
        bodyType: 'json' as const,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}

test('crates commands map public registry metadata', async () => {
  const requests: string[] = [];
  const runContext = context(requests);
  assert.equal(
    (await search.run(runContext, { query: 'serde', limit: 1 }))[0]?.latestVersion,
    '1.0.0',
  );
  assert.equal((await crate.run(runContext, { name: 'serde' }))[0]?.license, 'MIT');
  assert.deepEqual(requests, [
    'https://crates.io/api/v1/crates',
    'https://crates.io/api/v1/crates/serde',
  ]);
});

test('crates validates names and limits', async () => {
  await assert.rejects(() => crate.run(context([]), { name: 'bad name' }), /not valid/);
  await assert.rejects(
    () => search.run(context([]), { query: 'serde', limit: 101 }),
    /between 1 and 100/,
  );
});
