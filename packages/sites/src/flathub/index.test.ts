import assert from 'node:assert/strict';
import test from 'node:test';
import app from './commands/app.js';
import search from './commands/search.js';
function context(requests: Array<{ url: string; method?: string; body?: unknown }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'flathub-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; method?: string; body?: unknown }) => {
      requests.push(request);
      const body = request.url.endsWith('/search')
        ? {
            hits: [
              {
                app_id: 'org.mozilla.firefox',
                name: 'Firefox',
                summary: 'Web browser',
                developer_name: 'Mozilla',
                project_license: 'MPL-2.0',
                is_free_license: true,
                main_categories: 'network',
                installs_last_month: 100000,
                updated_at: 1730000000,
              },
            ],
          }
        : {
            id: 'org.mozilla.firefox',
            name: 'Firefox',
            summary: 'Web browser',
            developer_name: 'Mozilla',
            project_license: 'MPL-2.0',
            is_free_license: true,
            categories: ['Network', 'WebBrowser'],
            keywords: ['Browser'],
            urls: { homepage: 'https://www.mozilla.org/firefox/' },
            releases: [{ version: '150.0.1', timestamp: '1777248000' }],
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
test('Flathub commands map search and AppStream metadata', async () => {
  const requests: Array<{ url: string; method?: string; body?: unknown }> = [];
  const runContext = context(requests);
  const rows = (await search.run(runContext, { query: 'firefox', limit: 5 })) as Array<{
    appId: string;
    updatedAt: string;
  }>;
  assert.equal(rows[0]?.appId, 'org.mozilla.firefox');
  assert.equal(rows[0]?.updatedAt, '2024-10-27');
  const detail = (await app.run(runContext, { 'app-id': 'org.mozilla.firefox' })) as Array<{
    latestVersion: string;
    categories: string;
  }>;
  assert.equal(detail[0]?.latestVersion, '150.0.1');
  assert.equal(detail[0]?.categories, 'Network, WebBrowser');
  assert.equal(requests[0]?.method, 'POST');
});
test('Flathub validates query, limit, and app ids', async () => {
  await assert.rejects(() => search.run(context([]), { query: '', limit: 25 }), /cannot be empty/);
  await assert.rejects(
    () => search.run(context([]), { query: 'x', limit: 101 }),
    /between 1 and 100/,
  );
  await assert.rejects(() => app.run(context([]), { 'app-id': 'no-dot' }), /not valid/);
});
