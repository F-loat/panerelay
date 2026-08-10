import assert from 'node:assert/strict';
import test from 'node:test';
import paper from './commands/paper.js';
import search from './commands/search.js';
import citations from './commands/citations.js';
import recommendations from './commands/recommendations.js';

function context(
  requests: Array<{ url: string; query?: unknown; headers?: unknown }>,
  body: unknown,
) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'semanticscholar-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: unknown; headers?: unknown }) => {
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

const row = (id: string, title: string, author: string) => ({
  paperId: id,
  title,
  year: 2024,
  authors: [{ name: author }],
  citationCount: 7,
  externalIds: { DOI: `10.1/${id}` },
});

test('Semantic Scholar maps paper, search, citations, and recommendations', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  const paperRow = (
    await paper.run(
      context(requests, {
        ...row('a'.repeat(40), 'Paper detail', 'Alice'),
        influentialCitationCount: 3,
        referenceCount: 12,
        tldr: { text: 'A concise summary.' },
      }),
      { id: '10.1000/test' },
    )
  )[0] as Record<string, unknown>;
  assert.equal(paperRow.paperId, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(paperRow.tldr, 'A concise summary.');
  assert.equal(
    requests[0]?.query &&
      (requests[0]?.query as Array<{ name: string }>).some(item => item.name === 'fields'),
    true,
  );

  const searchRows = await search.run(
    context(requests, { data: [row('search-id', 'Search hit', 'Bob')] }),
    { query: 'transformers', limit: 1 },
  );
  assert.equal((searchRows[0] as Record<string, unknown>).rank, 1);

  const citationRows = await citations.run(
    context(requests, { data: [{ citingPaper: row('cite-id', 'Citing paper', 'Carol') }] }),
    { id: '10.1000/test', limit: 1, offset: 10 },
  );
  assert.equal((citationRows[0] as Record<string, unknown>).rank, 11);

  const recommendationRows = await recommendations.run(
    context(requests, { recommendedPapers: [row('rec-id', 'Related paper', 'Dana')] }),
    { id: '10.1000/test', limit: 1 },
  );
  assert.equal((recommendationRows[0] as Record<string, unknown>).paperId, 'rec-id');
});

test('Semantic Scholar validates references and numeric arguments before fetching', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  await assert.rejects(
    () => paper.run(context(requests, {}), { id: 'not-a-reference' }),
    /not recognised/,
  );
  await assert.rejects(
    () => search.run(context(requests, {}), { query: '', limit: 20 }),
    /cannot be empty/,
  );
  await assert.rejects(
    () => search.run(context(requests, {}), { query: 'x', limit: 101 }),
    /between 1 and 100/,
  );
  await assert.rejects(
    () => citations.run(context(requests, {}), { id: '10.1000/x', offset: 10000 }),
    /between 0 and 9999/,
  );
  assert.equal(requests.length, 0);
});
