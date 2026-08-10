import assert from 'node:assert/strict';
import test from 'node:test';
import rfc from './commands/rfc.js';

function context(requests: Array<{ url: string; query?: unknown }>, body: unknown, status = 200) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'rfc-test',
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

test('RFC maps metadata, authors, group, dates, and URLs', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  const rows = await rfc.run(
    context(requests, {
      name: 'rfc9000',
      title: 'QUIC: A UDP-Based Multiplexed and Secure Transport',
      state: 'Published',
      std_level: 'Proposed Standard',
      group: { name: 'QUIC', type: 'WG' },
      pages: 151,
      time: '2022-02-19 08:46:51',
      authors: [{ name: 'Jana Iyengar' }, { name: 'Martin Thomson' }],
      abstract: 'This document defines QUIC.',
    }),
    { number: 'rfc9000' },
  );
  assert.deepEqual(rows[0], {
    rfc: 9000,
    title: 'QUIC: A UDP-Based Multiplexed and Secure Transport',
    state: 'Published',
    stdLevel: 'Proposed Standard',
    group: 'QUIC',
    groupType: 'WG',
    pages: 151,
    published: '2022-02-19',
    authors: 'Jana Iyengar, Martin Thomson',
    abstract: 'This document defines QUIC.',
    rfcEditorUrl: 'https://www.rfc-editor.org/rfc/rfc9000',
    url: 'https://datatracker.ietf.org/doc/rfc9000/',
  });
  assert.equal(requests[0]?.url, 'https://datatracker.ietf.org/doc/rfc9000/doc.json');
});

test('RFC validates numbers before fetching', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  await assert.rejects(() => rfc.run(context(requests, {}), { number: 'abc' }), /not valid/);
  await assert.rejects(() => rfc.run(context(requests, {}), { number: 0 }), /not valid/);
  await assert.rejects(() => rfc.run(context(requests, {}), { number: 1000000 }), /not valid/);
  assert.equal(requests.length, 0);
});

test('RFC maps not-found responses', async () => {
  await assert.rejects(() => rfc.run(context([], {}, 404), { number: 999998 }), /not found/);
  await assert.rejects(() => rfc.run(context([], {}, 429), { number: 9000 }), /rate limited/);
});
