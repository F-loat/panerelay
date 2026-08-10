import assert from 'node:assert/strict';
import test from 'node:test';
import search from './commands/search.js';
import synonymsCommand from './commands/synonyms.js';
import examplesCommand from './commands/examples.js';

const body = [
  {
    word: 'serendipity',
    phonetics: [{ text: '/ˌserənˈdipədē/' }],
    meanings: [
      {
        partOfSpeech: 'noun',
        synonyms: ['chance'],
        definitions: [
          {
            definition: 'The occurrence of events by chance.',
            example: 'A fortunate stroke of serendipity.',
            synonyms: ['fortune'],
          },
        ],
      },
    ],
  },
];
function context(status = 200, payload: unknown = body) {
  const requests: Array<{ url: string }> = [];
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    requests,
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'dictionary-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    },
    fetch: async (request: { url: string }) => {
      requests.push(request);
      return {
        status,
        statusText: status === 200 ? 'OK' : 'Not Found',
        headers: {},
        body: payload,
        bodyType: 'json' as const,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}

test('Dictionary maps definitions, synonyms, and examples', async () => {
  const ctx = context();
  assert.deepEqual(await search.run(ctx, { word: 'serendipity' }), [
    {
      word: 'serendipity',
      phonetic: '/ˌserənˈdipədē/',
      type: 'noun',
      definition: 'The occurrence of events by chance.',
    },
  ]);
  assert.deepEqual(await synonymsCommand.run(ctx, { word: 'serendipity' }), [
    { word: 'serendipity', synonyms: 'chance, fortune' },
  ]);
  assert.deepEqual(await examplesCommand.run(ctx, { word: 'serendipity' }), [
    { word: 'serendipity', example: 'A fortunate stroke of serendipity.' },
  ]);
  assert.match(ctx.requests[0]?.url ?? '', /serendipity/);
});

test('Dictionary rejects empty and missing words', async () => {
  await assert.rejects(() => search.run(context(), { word: '' }), /cannot be empty/);
  await assert.rejects(
    () => search.run(context(404, { title: 'No entry' }), { word: 'missing' }),
    /was not found/,
  );
});
