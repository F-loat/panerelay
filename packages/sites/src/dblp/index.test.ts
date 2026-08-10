import assert from 'node:assert/strict';
import test from 'node:test';
import author from './commands/author.js';
import paper from './commands/paper.js';
import search from './commands/search.js';
import venue from './commands/venue.js';

function context(requests: string[]) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'dblp-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; responseType: 'json' | 'text' }) => {
      requests.push(request.url);
      const xml =
        '<inproceedings key="conf/nips/Test20"><author>Ada Lovelace</author><title>Attention.</title><booktitle>NIPS</booktitle><year>2020</year><pages>1-2</pages><ee type="oa">https://doi.org/10.1000/test</ee></inproceedings>';
      const body = request.url.includes('/search/publ/')
        ? {
            result: {
              hits: {
                hit: [
                  {
                    info: {
                      key: 'conf/nips/Test20',
                      title: 'Attention.',
                      authors: { author: { text: 'Ada Lovelace' } },
                      venue: 'NIPS',
                      year: '2020',
                      type: 'Conference and Workshop Papers',
                      doi: '10.1000/test',
                      ee: 'https://doi.org/10.1000/test',
                    },
                  },
                ],
              },
            },
          }
        : request.url.includes('/search/venue/')
          ? {
              result: {
                hits: {
                  hit: [
                    {
                      info: {
                        acronym: 'NIPS',
                        venue: 'NeurIPS',
                        type: 'Conference or Workshop',
                        url: '/streams/conf/nips',
                      },
                    },
                  ],
                },
              },
            }
          : request.url.includes('/search/author/')
            ? {
                result: {
                  hits: {
                    hit: [{ info: { author: 'Ada Lovelace', url: 'https://dblp.org/pid/12/345' } }],
                  },
                },
              }
            : request.url.includes('/pid/')
              ? `<dblpperson><r>${xml}</r></dblpperson>`
              : xml;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body,
        bodyType: request.responseType,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}

test('DBLP commands map public JSON and XML endpoints', async () => {
  const requests: string[] = [];
  const runContext = context(requests);
  assert.equal(
    (await search.run(runContext, { query: 'attention', limit: 1 }))[0]?.key,
    'conf/nips/Test20',
  );
  assert.equal((await venue.run(runContext, { query: 'NIPS', limit: 1 }))[0]?.acronym, 'NIPS');
  assert.equal((await paper.run(runContext, { key: 'conf/nips/Test20' }))[0]?.doi, '10.1000/test');
  assert.equal(
    (await author.run(runContext, { author: 'Ada Lovelace', limit: 1 }))[0]?.pid,
    '12/345',
  );
  assert.deepEqual(requests, [
    'https://dblp.org/search/publ/api?q=attention&format=json&h=1',
    'https://dblp.org/search/venue/api?q=NIPS&format=json&h=1',
    'https://dblp.org/rec/conf/nips/Test20.xml',
    'https://dblp.org/search/author/api?q=Ada%20Lovelace&format=json&h=20',
    'https://dblp.org/pid/12/345.xml',
  ]);
});

test('DBLP validates keys, queries, and limits', async () => {
  await assert.rejects(() => paper.run(context([]), { key: 'bad key' }), /not valid/);
  await assert.rejects(() => search.run(context([]), { query: '', limit: 1 }), /cannot be empty/);
  await assert.rejects(
    () => venue.run(context([]), { query: 'NIPS', limit: 101 }),
    /between 1 and 100/,
  );
});
