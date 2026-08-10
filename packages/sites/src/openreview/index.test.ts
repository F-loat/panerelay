import assert from 'node:assert/strict';
import test from 'node:test';
import author from './commands/author.js';
import paper from './commands/paper.js';
import reviews from './commands/reviews.js';
import search from './commands/search.js';
import venue from './commands/venue.js';

function note(id = 'ABC123') {
  return {
    id,
    cdate: 1_700_000_000_000,
    content: {
      title: { value: 'A Paper' },
      authors: { value: ['Ada Lovelace'] },
      authorids: { value: ['~Ada_Lovelace1'] },
      keywords: { value: ['ml'] },
      venue: { value: 'ICLR 2024' },
      venueid: { value: 'ICLR.cc/2024/Conference' },
      primary_area: { value: 'ML' },
      abstract: { value: 'Abstract' },
      pdf: { value: `/pdf/${id}.pdf` },
      rating: { value: '8' },
      confidence: { value: '4' },
    },
    invitations: ['ICLR.cc/2024/Conference/-/Official_Review'],
    signatures: ['~Ada_Lovelace1'],
  };
}
function context(requests: string[]) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'openreview-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string }) => {
      requests.push(request.url);
      const body = request.url.includes('/notes/search')
        ? { notes: [note()] }
        : request.url.includes('content.authorids')
          ? { notes: [note()] }
          : request.url.includes('content.venue')
            ? { notes: [note()] }
            : request.url.includes('details=replies')
              ? { notes: [note('REV123')] }
              : { notes: [note()] };
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

test('OpenReview commands map all public read workflows', async () => {
  const requests: string[] = [];
  const runContext = context(requests);
  assert.equal((await search.run(runContext, { query: 'paper', limit: 1 }))[0]?.title, 'A Paper');
  assert.equal(
    (await paper.run(runContext, { id: 'ABC123' }))[0]?.pdf,
    'https://openreview.net/pdf/ABC123.pdf',
  );
  assert.equal(
    (await author.run(runContext, { profile: '~Ada_Lovelace1', limit: 1 }))[0]?.id,
    'ABC123',
  );
  assert.equal(
    (await venue.run(runContext, { venue: 'ICLR 2024', limit: 1, offset: 2 }))[0]?.rank,
    3,
  );
  assert.equal(
    (await reviews.run(runContext, { forum: 'ABC123', 'max-length': 400 }))[1]?.type,
    'REVIEW',
  );
  assert.equal(requests.length, 6);
});
test('OpenReview validates identifiers and limits', async () => {
  await assert.rejects(() => paper.run(context([]), { id: 'bad' }), /not valid/);
  await assert.rejects(
    () => search.run(context([]), { query: 'paper', limit: 51 }),
    /between 1 and 50/,
  );
  await assert.rejects(
    () => reviews.run(context([]), { forum: 'ABC123', 'max-length': 100 }),
    /at least 200/,
  );
});
