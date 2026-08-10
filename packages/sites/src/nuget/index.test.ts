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
      requestId: 'nuget-test',
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
      const body = request.url.endsWith('/query')
        ? {
            data: [
              {
                id: 'Newtonsoft.Json',
                version: '13.0.3',
                title: 'Json.NET',
                description: 'JSON library',
                authors: ['JNK'],
                tags: ['json'],
                totalDownloads: 100,
                verified: true,
                projectUrl: 'https://www.newtonsoft.com/json',
              },
            ],
          }
        : request.url.includes('/index.json')
          ? {
              items: [
                {
                  items: [
                    {
                      catalogEntry: {
                        id: 'Newtonsoft.Json',
                        version: '13.0.3',
                        title: 'Json.NET',
                        authors: ['JNK'],
                        tags: ['json'],
                        licenseExpression: 'MIT',
                        published: '2023-03-08T20:00:00Z',
                        listed: true,
                      },
                    },
                  ],
                },
              ],
            }
          : {
              items: [
                {
                  catalogEntry: {
                    id: 'Newtonsoft.Json',
                    version: '12.0.0',
                    published: '2018-01-17T00:00:00Z',
                  },
                },
              ],
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
test('NuGet commands map search and registration version history', async () => {
  const requests: Array<{ url: string; query: unknown }> = [];
  const runContext = context(requests);
  const rows = await search.run(runContext, { query: 'newtonsoft', limit: 10, prerelease: false });
  assert.equal(rows[0]?.id, 'Newtonsoft.Json');
  const versions = await packageCommand.run(runContext, { id: 'Newtonsoft.Json' });
  assert.equal(versions[0]?.version, '13.0.3');
  assert.deepEqual(requests[0]?.query, [
    { name: 'q', value: 'newtonsoft' },
    { name: 'take', value: '10' },
    { name: 'prerelease', value: 'false' },
  ]);
});
test('NuGet validates package ids and limits', async () => {
  await assert.rejects(() => packageCommand.run(context([]), { id: 'bad id' }), /not valid/);
  await assert.rejects(
    () => search.run(context([]), { query: 'json', limit: 1001 }),
    /between 1 and 1000/,
  );
});
