import assert from 'node:assert/strict';
import test from 'node:test';
import search from './commands/search.js';
import entity from './commands/entity.js';

function context(requests: Array<{ url: string; query?: unknown }>, body: unknown, status = 200) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'wikidata-test',
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

test('Wikidata maps search and entity details', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  const rows = await search.run(
    context(requests, {
      search: [
        {
          id: 'Q937',
          label: 'Albert Einstein',
          description: 'physicist',
          match: { type: 'alias', text: 'Einstein' },
        },
      ],
    }),
    { query: 'einstein', language: 'en', limit: 5 },
  );
  assert.deepEqual(rows[0], {
    rank: 1,
    qid: 'Q937',
    label: 'Albert Einstein',
    description: 'physicist',
    matchType: 'alias',
    matchText: 'Einstein',
    url: 'https://www.wikidata.org/wiki/Q937',
  });
  assert.equal(
    (requests[0]?.query as Array<{ name: string; value: string }>).find(
      item => item.name === 'language',
    )?.value,
    'en',
  );

  const details = await entity.run(
    context(requests, {
      entities: {
        Q937: {
          type: 'item',
          modified: '2026-01-01T00:00:00Z',
          labels: { en: { value: 'Albert Einstein' } },
          descriptions: { en: { value: 'physicist' } },
          aliases: { en: [{ value: 'A. Einstein' }] },
          claims: { P31: [], P21: [] },
          sitelinks: { enwiki: { title: 'Albert Einstein' } },
        },
      },
    }),
    { id: 'https://www.wikidata.org/wiki/Q937', language: 'zh' },
  );
  assert.deepEqual(details[0], {
    qid: 'Q937',
    type: 'item',
    label: 'Albert Einstein',
    description: 'physicist',
    aliases: 'A. Einstein',
    claimPropertyCount: 2,
    sitelinkCount: 1,
    enwikiTitle: 'Albert Einstein',
    modified: '2026-01-01T00:00:00Z',
    url: 'https://www.wikidata.org/wiki/Q937',
  });
});

test('Wikidata validates arguments and maps failures', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  await assert.rejects(
    () => search.run(context(requests, {}), { query: '', limit: 5 }),
    /cannot be empty/,
  );
  await assert.rejects(
    () => search.run(context(requests, {}), { query: 'x', limit: 51 }),
    /between 1 and 50/,
  );
  await assert.rejects(() => entity.run(context(requests, {}), { id: 'not-a-qid' }), /not valid/);
  await assert.rejects(() => entity.run(context([], {}, 404), { id: 'Q999' }), /not found/);
  await assert.rejects(() => search.run(context([], {}, 429), { query: 'x' }), /rate limited/);
  assert.equal(requests.length, 0);
});
