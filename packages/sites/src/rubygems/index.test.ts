import assert from 'node:assert/strict';
import test from 'node:test';
import gem from './commands/gem.js';
import search from './commands/search.js';
function context(requests: Array<{ url: string; query: unknown }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'rubygems-test',
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
        ? [
            {
              name: 'rails',
              version: '8.0.0',
              downloads: 1000,
              licenses: ['MIT'],
              authors: 'Rails team',
              info: 'Web framework',
            },
          ]
        : {
            name: 'rails',
            version: '8.0.0',
            version_created_at: '2024-01-02T03:04:05.123Z',
            downloads: 100000,
            version_downloads: 5000,
            licenses: ['MIT'],
            authors: 'Rails team',
            homepage_uri: 'https://rubyonrails.org',
            source_code_uri: 'https://github.com/rails/rails',
            bug_tracker_uri: '',
            info: 'Web framework',
            project_uri: 'https://rubygems.org/gems/rails',
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
test('RubyGems commands map gem metadata and search', async () => {
  const requests: Array<{ url: string; query: unknown }> = [];
  const runContext = context(requests);
  const detail = await gem.run(runContext, { name: 'rails' });
  assert.equal(detail[0]?.releasedAt, '2024-01-02T03:04:05Z');
  const rows = await search.run(runContext, { query: 'rails', limit: 10 });
  assert.equal(rows[0]?.gem, 'rails');
  assert.deepEqual(requests[1]?.query, [
    { name: 'query', value: 'rails' },
    { name: 'page', value: '1' },
  ]);
});
test('RubyGems validates gem names and limits', async () => {
  await assert.rejects(() => gem.run(context([]), { name: 'bad gem' }), /not valid/);
  await assert.rejects(
    () => search.run(context([]), { query: 'rails', limit: 101 }),
    /between 1 and 100/,
  );
});
