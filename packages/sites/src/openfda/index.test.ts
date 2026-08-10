import assert from 'node:assert/strict';
import test from 'node:test';
import drugLabel from './commands/drug-label.js';
import foodRecall from './commands/food-recall.js';

function context(requests: Array<{ url: string; query?: unknown }>, body: unknown) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'openfda-test',
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

test('openFDA maps drug labels and food recalls', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  const label = (
    await drugLabel.run(
      context(requests, {
        results: [
          {
            id: 'label-1',
            effective_time: '20250101',
            purpose: ['Pain reliever'],
            openfda: {
              brand_name: ['Aspirin Bayer'],
              generic_name: ['ASPIRIN'],
              manufacturer_name: ['Bayer'],
              route: ['ORAL', 'TOPICAL'],
              pharm_class_epc: ['NSAID'],
            },
          },
        ],
      }),
      { query: 'aspirin', limit: 1 },
    )
  )[0] as { brandName: string; route: string; purpose: string };
  assert.equal(label.brandName, 'Aspirin Bayer');
  assert.equal(label.route, 'ORAL, TOPICAL');
  assert.equal(label.purpose, 'Pain reliever');
  assert.deepEqual(requests[0]?.query, [
    { name: 'search', value: 'openfda.brand_name:"aspirin" OR openfda.generic_name:"aspirin"' },
    { name: 'limit', value: '1' },
  ]);

  const recall = (
    await foodRecall.run(
      context(requests, {
        results: [
          {
            recall_number: 'F-1',
            classification: 'Class I',
            recalling_firm: 'Acme Foods',
            report_date: '20260415',
            termination_date: null,
          },
        ],
      }),
      { query: 'salmonella', status: 'Ongoing', classification: 'Class I', limit: 5 },
    )
  )[0] as { recallNumber: string; classification: string; terminationDate: string | null };
  assert.equal(recall.recallNumber, 'F-1');
  assert.equal(recall.classification, 'Class I');
  assert.equal(recall.terminationDate, null);
  assert.deepEqual(requests[1]?.query, [
    { name: 'search', value: 'salmonella AND status:"Ongoing" AND classification:"Class I"' },
    { name: 'limit', value: '5' },
  ]);
});

test('openFDA validates required query and limits before fetching', async () => {
  const requests: Array<{ url: string; query?: unknown }> = [];
  await assert.rejects(
    () => drugLabel.run(context(requests, {}), { query: '', limit: 5 }),
    /cannot be empty/,
  );
  await assert.rejects(
    () => drugLabel.run(context(requests, {}), { query: 'aspirin', limit: 26 }),
    /between 1 and 25/,
  );
  await assert.rejects(
    () => foodRecall.run(context(requests, {}), { limit: 101 }),
    /between 1 and 100/,
  );
  assert.equal(requests.length, 0);
});

test('openFDA maps HTTP failures', async () => {
  const contextWithStatus = (status: number) => ({
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: context([], {}).invocation,
    fetch: async () => ({
      status,
      statusText: 'Error',
      headers: {},
      body: {},
      bodyType: 'json' as const,
      url: 'https://api.fda.gov',
      redirected: false,
      attachedCookieCount: 0,
    }),
  });
  await assert.rejects(() => foodRecall.run(contextWithStatus(404), {}), /no matching records/);
  await assert.rejects(() => foodRecall.run(contextWithStatus(429), {}), /rate limited/);
});
