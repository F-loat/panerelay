import assert from 'node:assert/strict';
import test from 'node:test';
import search from './commands/search.js';
import show from './commands/show.js';

function context(requests: Array<{ url: string; query?: unknown }>, body: unknown, status = 200) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'tvmaze-test',
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
      requests.push(request);
      return {
        status,
        statusText: status === 200 ? 'OK' : 'Error',
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

const sampleShow = {
  id: 169,
  name: 'Breaking Bad',
  type: 'Scripted',
  language: 'English',
  genres: ['Drama'],
  status: 'Ended',
  premiered: '2008-01-20',
  ended: '2019-10-11',
  runtime: 60,
  averageRuntime: 60,
  network: { name: 'AMC', country: { name: 'United States' } },
  schedule: { time: '22:00', days: ['Sunday'] },
  rating: { average: 9.2 },
  externals: { imdb: 'tt0903747', thetvdb: 81189 },
  officialSite: 'http://www.amc.com/shows/breaking-bad',
  summary: '<p><b>Breaking Bad</b> &amp; &#39;hex&#39; &hellip;.</p>',
  url: 'https://www.tvmaze.com/shows/169/breaking-bad',
};

test('TVmaze maps search and show detail fields', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  const rows = await search.run(context(requests, [{ score: 1.2, show: sampleShow }]), {
    query: 'breaking bad',
    limit: 5,
  });
  assert.equal((rows[0] as Record<string, unknown>).id, 169);
  assert.equal((rows[0] as Record<string, unknown>).summary, "Breaking Bad & 'hex' ….");
  assert.deepEqual(requests[0]?.query, [{ name: 'q', value: 'breaking bad' }]);

  const details = await show.run(context(requests, sampleShow), { id: 169 });
  assert.deepEqual(details[0], {
    id: 169,
    name: 'Breaking Bad',
    type: 'Scripted',
    language: 'English',
    genres: 'Drama',
    status: 'Ended',
    premiered: '2008-01-20',
    ended: '2019-10-11',
    runtime: 60,
    averageRuntime: 60,
    network: 'AMC',
    country: 'United States',
    schedule: 'Sunday 22:00',
    rating: 9.2,
    imdb: 'tt0903747',
    thetvdb: 81189,
    officialSite: 'http://www.amc.com/shows/breaking-bad',
    summary: "Breaking Bad & 'hex' ….",
    url: 'https://www.tvmaze.com/shows/169/breaking-bad',
  });
});

test('TVmaze validates arguments and maps HTTP failures', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  await assert.rejects(
    () => search.run(context(requests, []), { query: '', limit: 5 }),
    /cannot be empty/,
  );
  await assert.rejects(
    () => search.run(context(requests, []), { query: 'x', limit: 51 }),
    /between 1 and 50/,
  );
  await assert.rejects(() => show.run(context(requests, {}), { id: 0 }), /positive integer/);
  await assert.rejects(() => show.run(context([], {}, 404), { id: 999 }), /not found/);
  await assert.rejects(() => show.run(context([], {}, 429), { id: 169 }), /rate limited/);
  assert.equal(requests.length, 0);
});
