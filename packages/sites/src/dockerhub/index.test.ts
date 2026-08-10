import assert from 'node:assert/strict';
import test from 'node:test';
import image from './commands/image.js';
import search from './commands/search.js';

function context(requests: Array<{ url: string; query: unknown }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'dockerhub-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: unknown }) => {
      requests.push({ url: request.url, query: request.query });
      const body = request.url.includes('/search/repositories/')
        ? {
            results: [
              {
                repo_owner: '',
                repo_name: 'nginx',
                is_official: true,
                star_count: 20,
                pull_count: 1000,
                short_description: 'Web server',
              },
            ],
          }
        : {
            namespace: 'library',
            star_count: 20000,
            pull_count: 1000000000,
            description: 'Official image',
            last_updated: '2026-01-02T03:04:05.123Z',
            last_modified: '2026-01-01T03:04:05Z',
            date_registered: '2015-01-01T00:00:00Z',
            status_description: 'active',
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

test('Docker Hub commands map public repository metadata and search', async () => {
  const requests: Array<{ url: string; query: unknown }> = [];
  const runContext = context(requests);
  const detail = await image.run(runContext, { image: 'nginx' });
  assert.equal(detail[0]?.image, 'library/nginx');
  assert.equal(detail[0]?.lastUpdated, '2026-01-02T03:04:05Z');
  const rows = await search.run(runContext, { query: 'nginx', limit: 10 });
  assert.deepEqual(rows[0], {
    rank: 1,
    image: 'library/nginx',
    official: true,
    stars: 20,
    pulls: 1000,
    description: 'Web server',
    url: 'https://hub.docker.com/r/library/nginx',
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1]?.query, [
    { name: 'query', value: 'nginx' },
    { name: 'page_size', value: '10' },
  ]);
});

test('Docker Hub validates image names and limits', async () => {
  await assert.rejects(() => image.run(context([]), { image: 'bad image' }), /not valid/);
  await assert.rejects(
    () => search.run(context([]), { query: 'nginx', limit: 101 }),
    /between 1 and 100/,
  );
});
