import assert from 'node:assert/strict';
import test from 'node:test';
import news from './commands/news.js';
import topic from './commands/topic.js';

function context(body: string, requests: Array<{ url: string }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'bbc',
      operation: 'execute' as const,
      command: 'news',
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
const RSS =
  '<rss><channel><item><title><![CDATA[AI &amp; science]]></title><description><![CDATA[Brief description]]></description><link>https://bbc.test/1</link><pubDate>Sat, 08 Aug 2026 10:00:00 GMT</pubDate></item></channel></rss>';

test('BBC commands parse public RSS feeds', async () => {
  const requests: Array<{ url: string }> = [];
  const headline = await news.run(context(RSS, requests), { limit: 1 });
  assert.equal((headline as Array<{ title: string }>)[0]?.title, 'AI & science');
  const section = await topic.run(context(RSS, requests), {
    topic: 'science-and-environment',
    limit: 1,
  });
  assert.equal((section as Array<{ pubDate: string }>)[0]?.pubDate, '2026-08-08');
  assert.ok(requests.some(request => request.url.endsWith('/news/rss.xml')));
  assert.ok(
    requests.some(request => request.url.endsWith('/news/science_and_environment/rss.xml')),
  );
});

test('BBC topic rejects unknown sections', async () => {
  await assert.rejects(() => topic.run(context('', []), { topic: 'sports' }), /not supported/);
});
