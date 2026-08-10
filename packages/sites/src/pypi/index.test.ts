import assert from 'node:assert/strict';
import test from 'node:test';
import downloads from './commands/downloads.js';
import packageCommand from './commands/package.js';
function context(requests: Array<{ url: string; query: unknown }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'pypi-test',
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
      const body = request.url.includes('/recent')
        ? { package: 'requests', data: { last_day: 10, last_week: 70, last_month: 300 } }
        : request.url.includes('/overall')
          ? {
              package: 'requests',
              data: [
                { date: '2024-01-01', downloads: 10 },
                { date: '2024-01-02', downloads: 20 },
              ],
            }
          : {
              info: {
                name: 'requests',
                version: '2.32.0',
                summary: 'HTTP library',
                author: 'Kenneth Reitz',
                license: 'Apache-2.0',
                home_page: 'https://requests.readthedocs.io',
                requires_python: '>=3.8',
                keywords: 'http, client',
                package_url: 'https://pypi.org/project/requests/',
              },
              releases: {
                '2.32.0': [{ upload_time: '2024-01-02T00:00:00Z' }],
                '2.31.0': [{ upload_time: '2023-06-01T00:00:00Z' }],
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
test('PyPI commands map package metadata and recent/overall downloads', async () => {
  const requests: Array<{ url: string; query: unknown }> = [];
  const runContext = context(requests);
  const detail = await packageCommand.run(runContext, { name: 'requests' });
  assert.equal(detail[0]?.latestVersion, '2.32.0');
  assert.equal(detail[0]?.releases, 2);
  const recent = await downloads.run(runContext, { name: 'requests', period: 'recent' });
  assert.equal(recent[2]?.downloads, 300);
  const overall = await downloads.run(runContext, { name: 'requests', period: 'overall' });
  assert.equal(overall.length, 2);
  assert.deepEqual(requests[2]?.query, [{ name: 'mirrors', value: 'false' }]);
});
test('PyPI validates package names and periods', async () => {
  await assert.rejects(() => packageCommand.run(context([]), { name: 'bad package' }), /not valid/);
  await assert.rejects(
    () => downloads.run(context([]), { name: 'requests', period: 'weekly' }),
    /invalid/,
  );
});
