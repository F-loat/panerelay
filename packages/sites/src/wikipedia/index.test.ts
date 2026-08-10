import assert from 'node:assert/strict';
import test from 'node:test';
import page from './commands/page.js';
import search from './commands/search.js';
import summary from './commands/summary.js';
import random from './commands/random.js';
import trending from './commands/trending.js';

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
      requestId: 'wikipedia',
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

test('Wikipedia commands map public REST and Action API responses', async () => {
  const requests: Array<{ url: string; query?: { name: string; value: string }[] }> = [];
  const searchResult = await search.run(
    context(
      { query: { search: [{ title: 'Transformer', snippet: '<span>Model</span>' }] } },
      requests,
    ),
    { query: 'transformer', limit: 1, lang: 'en' },
  );
  assert.equal((searchResult as Array<{ snippet: string }>)[0]?.snippet, 'Model');
  const summaryResult = await summary.run(
    context(
      {
        title: 'Transformer',
        description: 'Model',
        extract: 'A transformer is a model.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Transformer' } },
      },
      requests,
    ),
    { title: 'Transformer', lang: 'en' },
  );
  assert.equal((summaryResult as Array<{ title: string }>)[0]?.title, 'Transformer');
  const pageResult = await page.run(
    context(
      {
        query: {
          pages: [
            {
              pageid: 1,
              title: 'Transformer',
              description: 'Model',
              extract: 'First paragraph.\n\nSecond paragraph.',
              fullurl: 'https://en.wikipedia.org/wiki/Transformer',
            },
          ],
        },
      },
      requests,
    ),
    { title: 'Transformer', paragraphs: 1, lang: 'en' },
  );
  assert.equal((pageResult as Array<{ paragraphs: number }>)[0]?.paragraphs, 1);
  const randomResult = await random.run(
    context({ title: 'Random', extract: 'A random article.' }, requests),
    { lang: 'zh' },
  );
  assert.equal((randomResult as Array<{ title: string }>)[0]?.title, 'Random');
  const trendingResult = await trending.run(
    context(
      { mostread: { articles: [{ title: 'Hot', description: 'Popular', views: 123 }] } },
      requests,
    ),
    { limit: 1, lang: 'en' },
  );
  assert.equal((trendingResult as Array<{ views: number }>)[0]?.views, 123);
  assert.ok(requests.some(request => request.url.includes('wikipedia.org/w/api.php')));
  assert.ok(requests.some(request => request.url.includes('/api/rest_v1/page/summary')));
});
