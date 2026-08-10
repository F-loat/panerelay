import assert from 'node:assert/strict';
import test from 'node:test';
import packageCommand from './commands/package.js';
import search from './commands/search.js';
function context(requests: Array<{ url: string; query: unknown }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'packagist-test',
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
      const body = request.url.includes('/search.json')
        ? {
            results: [
              {
                name: 'symfony/console',
                description: 'Console component',
                downloads: 100,
                favers: 20,
                repository: 'https://github.com/symfony/console',
                url: 'https://packagist.org/packages/symfony/console',
              },
            ],
          }
        : {
            package: {
              name: 'symfony/console',
              description: 'Console component',
              repository: 'https://github.com/symfony/console',
              github_stars: 5000,
              favers: 300,
              downloads: { total: 100000, monthly: 10000, daily: 500 },
              versions: {
                '7.0.0': { time: '2024-01-02T03:04:05+00:00', license: ['MIT'] },
                '7.1.x-dev': { time: '2024-02-01T00:00:00+00:00', license: ['MIT'] },
              },
            },
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
test('Packagist commands map package metadata and search', async () => {
  const requests: Array<{ url: string; query: unknown }> = [];
  const runContext = context(requests);
  const detail = await packageCommand.run(runContext, { name: 'symfony/console' });
  assert.equal(detail[0]?.version, '7.0.0');
  assert.equal(detail[0]?.releasedAt, '2024-01-02T03:04:05Z');
  const rows = await search.run(runContext, { query: 'symfony', limit: 10 });
  assert.equal(rows[0]?.package, 'symfony/console');
  assert.deepEqual(requests[1]?.query, [
    { name: 'q', value: 'symfony' },
    { name: 'per_page', value: '10' },
  ]);
});
test('Packagist validates package names and limits', async () => {
  await assert.rejects(() => packageCommand.run(context([]), { name: 'invalid' }), /not valid/);
  await assert.rejects(
    () => search.run(context([]), { query: 'symfony', limit: 101 }),
    /between 1 and 100/,
  );
});
