import assert from 'node:assert/strict';
import test from 'node:test';
import episodes from './commands/episodes.js';
import search from './commands/search.js';
import top from './commands/top.js';

function context(
  bodies: unknown[],
  requests: Array<{ url: string; query?: { name: string; value: string }[] }>,
) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'apple-podcasts',
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
        body: bodies.shift(),
        bodyType: 'json' as const,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}

test('Apple Podcasts commands map search, episodes, and charts', async () => {
  const requests: Array<{ url: string; query?: { name: string; value: string }[] }> = [];
  const result = await search.run(
    context(
      [
        {
          results: [
            {
              collectionId: 123,
              collectionName: 'Tech',
              artistName: 'Ada',
              trackCount: 42,
              primaryGenreName: 'Technology',
              collectionViewUrl: 'https://podcasts.example/123',
            },
          ],
        },
      ],
      requests,
    ),
    { query: 'tech', limit: 1 },
  );
  assert.equal((result as Array<{ title: string }>)[0]?.title, 'Tech');
  const episodeResult = await episodes.run(
    context(
      [
        {
          results: [
            { kind: 'podcast' },
            {
              kind: 'podcast-episode',
              trackName: 'Episode 1',
              trackTimeMillis: 91_000,
              releaseDate: '2026-01-02T00:00:00Z',
            },
          ],
        },
      ],
      requests,
    ),
    { id: 123, limit: 1 },
  );
  assert.deepEqual((episodeResult as Array<{ duration: string; date: string }>)[0], {
    duration: '1:31',
    date: '2026-01-02',
    title: 'Episode 1',
  });
  const topResult = await top.run(
    context(
      [{ feed: { results: [{ name: 'Top Show', artistName: 'Ada', id: '123' }] } }],
      requests,
    ),
    { country: 'us', limit: 1 },
  );
  assert.equal((topResult as Array<{ rank: number }>)[0]?.rank, 1);
  assert.ok(requests.some(request => request.url.endsWith('/search')));
  assert.ok(requests.some(request => request.url.endsWith('/lookup')));
  assert.ok(requests.some(request => request.url.includes('/us/podcasts/top/1/podcasts.json')));
});

test('Apple Podcasts validates required query and country arguments', async () => {
  await assert.rejects(() => search.run(context([], []), { query: '' }), /query is required/);
  await assert.rejects(() => top.run(context([], []), { country: 'usa!' }), /country/);
});
