import assert from 'node:assert/strict';
import test from 'node:test';
import search from './commands/search.js';
import sequence from './commands/sequence.js';
function context(requests: Array<{ url: string; query: unknown }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'oeis-test',
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
      const body =
        request.url.endsWith('/search') &&
        requests.at(-1)?.query &&
        JSON.stringify(requests.at(-1)?.query).includes('id:A000040')
          ? [
              {
                number: 40,
                name: 'The prime numbers.',
                keyword: 'core,nonn',
                data: '2,3,5,7,11,13,17,19,23',
                offset: '1,1',
                author: 'Sloane',
                created: '1991',
                revision: 100,
                comment: ['c1'],
                formula: ['f1', 'f2'],
                reference: ['r1'],
                xref: ['A1'],
                link: ['l1', 'l2'],
              },
            ]
          : [
              {
                number: 45,
                name: 'Fibonacci numbers',
                keyword: 'core,nice',
                data: '0,1,1,2,3,5,8,13,21,34,55,89',
                author: 'Sloane',
              },
            ];
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
test('OEIS commands map search, pagination, and sequence detail', async () => {
  const requests: Array<{ url: string; query: unknown }> = [];
  const runContext = context(requests);
  assert.equal(
    ((await search.run(runContext, { query: 'fibonacci', limit: 1 })) as Array<{ id: string }>)[0]
      ?.id,
    'A000045',
  );
  const row = (
    (await sequence.run(runContext, { id: 'https://oeis.org/a000040' })) as Array<{
      id: string;
      commentCount: number;
    }>
  )[0];
  assert.equal(row?.id, 'A000040');
  assert.equal(row?.commentCount, 1);
  assert.deepEqual(requests[0]?.query, [
    { name: 'q', value: 'fibonacci' },
    { name: 'fmt', value: 'json' },
    { name: 'start', value: '0' },
  ]);
});
test('OEIS validates query, limits, and sequence ids', async () => {
  await assert.rejects(() => search.run(context([]), { query: '', limit: 10 }), /cannot be empty/);
  await assert.rejects(
    () => search.run(context([]), { query: 'x', limit: 101 }),
    /between 1 and 100/,
  );
  await assert.rejects(() => sequence.run(context([]), { id: 'B000045' }), /not valid/);
});
