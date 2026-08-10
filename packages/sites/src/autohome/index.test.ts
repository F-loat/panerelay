import assert from 'node:assert/strict';
import test from 'node:test';
import brand from './commands/brand.js';
import score from './commands/score.js';
function context(body: string, requests: Array<{ url: string }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'autohome',
      operation: 'execute' as const,
      command: 'brand',
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
        bodyType: 'text' as const,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}
test('Autohome commands map public series and score pages', async () => {
  const requests: Array<{ url: string }> = [];
  const rows = await brand.run(
    context(
      '<dl><dt><div><a>宝马</a></div></dt><li id="s123"><h4><a>Demo 3</a></h4>指导价：<em>20-30</em></li></dl>',
      requests,
    ),
    { brand: '宝马', limit: 1 },
  );
  assert.equal((rows as Array<{ seriesId: string }>)[0]?.seriesId, '123');
  const props = JSON.stringify({
    props: {
      pageProps: {
        baseData: {
          seriesname: 'Demo 3',
          brandName: '宝马',
          average: 4.5,
          seriesScoreList: [{ typeName: '空间', score: 4.2 }],
        },
        qualityData: { pph: 2, userCount: 10 },
      },
    },
  });
  const scoreRows = await score.run(
    context(`<script id="__NEXT_DATA__">${props}</script>`, requests),
    { 'series-id': '123' },
  );
  assert.equal(
    (scoreRows as Array<{ field: string }>).find(row => row.field === 'overall')?.field,
    'overall',
  );
  assert.ok(requests.some(request => request.url.includes('/grade/carhtml/B.html')));
  assert.ok(requests.some(request => request.url.endsWith('/123')));
});
test('Autohome validates series IDs', async () => {
  await assert.rejects(() => score.run(context('', []), { 'series-id': 'bad' }), /not valid/);
});
