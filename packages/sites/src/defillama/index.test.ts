import assert from 'node:assert/strict';
import test from 'node:test';
import protocol from './commands/protocol.js';
import protocols from './commands/protocols.js';

function context(requests: string[]) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'defillama-test',
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
      const body = request.url.endsWith('/protocols')
        ? [
            {
              slug: 'aave',
              name: 'Aave',
              category: 'Lending',
              tvl: 100,
              mcap: 10,
              change_1d: 1,
              change_7d: 2,
              chains: ['Ethereum'],
              listedAt: 1_700_000_000,
            },
          ]
        : {
            id: 'aave',
            name: 'Aave',
            isParentProtocol: false,
            tvl: [{ date: 1_700_000_000, totalLiquidityUSD: 100 }],
            mcap: 10,
            chains: ['Ethereum'],
            twitter: 'aave',
            github: ['aave/aave'],
            audits: '3',
            listedAt: 1_700_000_000,
            description: 'Lending protocol',
            url: 'https://aave.com',
          };
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

test('DefiLlama commands map public protocol data', async () => {
  const requests: string[] = [];
  const runContext = context(requests);
  assert.equal((await protocols.run(runContext, { limit: 1 }))[0]?.slug, 'aave');
  assert.equal((await protocol.run(runContext, { slug: 'aave' }))[0]?.tvl, 100);
  assert.deepEqual(requests, [
    'https://api.llama.fi/protocols',
    'https://api.llama.fi/protocol/aave',
    'https://api.llama.fi/protocols',
  ]);
});
test('DefiLlama validates slugs and limits', async () => {
  await assert.rejects(() => protocol.run(context([]), { slug: 'Bad Slug' }), /not valid/);
  await assert.rejects(() => protocols.run(context([]), { limit: 501 }), /between 1 and 500/);
});
