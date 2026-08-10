import assert from 'node:assert/strict';
import test from 'node:test';
import product from './commands/product.js';

function context(body: unknown, requests: Array<{ url: string }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'endoflife',
      operation: 'execute' as const,
      command: 'product',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string }) => {
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

test('endoflife product maps cycle dates, flags, status, and URL', async () => {
  const requests: Array<{ url: string }> = [];
  const rows = await product.run(
    context(
      [
        {
          cycle: '24',
          releaseDate: '2025-05-06',
          latest: '24.15.0',
          latestReleaseDate: '2026-04-15',
          lts: '2025-10-28',
          support: '2026-10-20',
          eol: '2028-04-30',
          extendedSupport: false,
        },
        { cycle: 'rolling', lts: false, support: true, eol: false, extendedSupport: false },
      ],
      requests,
    ),
    { product: 'NodeJS' },
  );
  assert.equal((rows as Array<{ product: string; eolStatus: string }>)[0]?.product, 'nodejs');
  assert.equal((rows as Array<{ eolStatus: string }>)[0]?.eolStatus, 'active');
  assert.equal((rows as Array<{ support: string; eol: null }>)[1]?.support, 'ongoing');
  assert.equal((rows as Array<{ eol: null }>)[1]?.eol, null);
  assert.equal(requests[0]?.url, 'https://endoflife.date/api/nodejs.json');
  await assert.rejects(
    () => product.run(context([], requests), { product: 'BAD/PRODUCT' }),
    /valid endoflife/,
  );
});
