import assert from 'node:assert/strict';
import test from 'node:test';
import search from './commands/search.js';
import work from './commands/work.js';

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
      requestId: 'openalex',
      operation: 'execute' as const,
      command: 'search',
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

test('OpenAlex search and work map scholarly metadata and inverted abstracts', async () => {
  const requests: Array<{ url: string; query?: { name: string; value: string }[] }> = [];
  const row = {
    id: 'https://openalex.org/W1234567890',
    doi: 'https://doi.org/10.1234/demo',
    title: 'Demo Work',
    publication_year: 2024,
    cited_by_count: 5,
    authorships: [{ author: { display_name: 'Ada' } }],
    primary_location: { source: { display_name: 'Demo Journal' } },
    open_access: { is_oa: true, oa_url: 'https://example.test/demo' },
    type: 'article',
    referenced_works: ['W1'],
    language: 'en',
    abstract_inverted_index: { Demo: [0], abstract: [1] },
  };
  const searchResult = await search.run(context({ results: [row] }, requests), {
    query: 'demo',
    limit: 1,
  });
  assert.equal((searchResult as Array<{ firstAuthor: string }>)[0]?.firstAuthor, 'Ada');
  const workResult = await work.run(context(row, requests), { id: '10.1234/demo' });
  assert.equal((workResult as Array<{ abstract: string }>)[0]?.abstract, 'Demo abstract');
  assert.ok(requests.some(request => request.url.endsWith('/works')));
  assert.ok(requests.some(request => request.url.includes('/works/doi%3A10.1234%2Fdemo')));
});
