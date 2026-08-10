import assert from 'node:assert/strict';
import test from 'node:test';
import packageCommand from './commands/package.js';
import downloads from './commands/downloads.js';
import search from './commands/search.js';

function context(
  body: unknown,
  requests: Array<{ url: string; query?: { name: string; value: string }[] }>,
) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'npm',
      operation: 'execute' as const,
      command: 'package',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: { name: string; value: string }[] }) => {
      requests.push(request);
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

test('npm commands map registry metadata, downloads, and search', async () => {
  const requests: Array<{ url: string; query?: { name: string; value: string }[] }> = [];
  const metadata = {
    name: 'react',
    'dist-tags': { latest: '18.2.0' },
    versions: {
      '18.2.0': {
        description: 'UI',
        license: 'MIT',
        repository: { url: 'git+https://github.com/facebook/react.git' },
        keywords: ['ui'],
      },
    },
    maintainers: [{ name: 'Dan' }],
    time: { created: '2013-01-01T00:00:00Z', modified: '2024-01-01T00:00:00Z' },
  };
  assert.equal(
    (
      (await packageCommand.run(context(metadata, requests), { name: 'react' })) as Array<{
        latestVersion: string;
      }>
    )[0]?.latestVersion,
    '18.2.0',
  );
  assert.equal(
    (
      (await downloads.run(
        context({ package: 'react', downloads: [{ day: '2024-01-01', downloads: 10 }] }, requests),
        { name: 'react', period: 'last-week' },
      )) as Array<{ downloads: number }>
    )[0]?.downloads,
    10,
  );
  assert.equal(
    (
      (await search.run(
        context(
          {
            objects: [
              { package: { name: 'react', version: '18.2.0' }, downloads: { weekly: 100 } },
            ],
          },
          requests,
        ),
        { query: 'react', limit: 1 },
      )) as Array<{ name: string }>
    )[0]?.name,
    'react',
  );
  await assert.rejects(
    () => downloads.run(context({}, requests), { name: 'react', period: '2024-02-01:2024-01-01' }),
    /period/,
  );
  assert.ok(requests.some(request => request.url.includes('registry.npmjs.org')));
  assert.ok(requests.some(request => request.url.includes('api.npmjs.org')));
});
