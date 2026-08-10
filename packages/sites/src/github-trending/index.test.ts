import assert from 'node:assert/strict';
import test from 'node:test';
import repos from './commands/repos.js';

function article(
  repo: string,
  stars: string,
  forks: string,
  period: string,
  description = 'Tools &amp; toys',
  language = 'Rust',
) {
  return `<article class="Box-row"><h2><a href="/${repo}">${repo}</a></h2><p class="col-9 color-fg-muted my-1">${description}</p><span itemprop="programmingLanguage">${language}</span><a href="/${repo}/stargazers">${stars}</a><a href="/${repo}/forks">${forks}</a><span>${period} stars today</span></article>`;
}
function context(html: string, status = 200) {
  const requests: Array<{ url: string; query?: unknown }> = [];
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    requests,
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'github-trending-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: unknown }) => {
      requests.push(request);
      return {
        status,
        statusText: 'OK',
        headers: {},
        body: html,
        bodyType: 'text' as const,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}

test('GitHub Trending maps repository rows and query parameters', async () => {
  const ctx = context(`<main>${article('owner/repo', '1,234', '56', '78')}</main>`);
  const rows = await repos.run(ctx, { since: 'weekly', language: 'c++', limit: 10 });
  assert.deepEqual(rows[0], {
    rank: 1,
    repo: 'owner/repo',
    description: 'Tools & toys',
    language: 'Rust',
    stars: 1234,
    forks: 56,
    starsSince: 78,
    url: 'https://github.com/owner/repo',
  });
  assert.equal(ctx.requests[0]?.url, 'https://github.com/trending/c%2B%2B');
  assert.deepEqual(ctx.requests[0]?.query, [{ name: 'since', value: 'weekly' }]);
});

test('GitHub Trending validates arguments and parser drift', async () => {
  await assert.rejects(() => repos.run(context(''), { since: 'yearly', limit: 1 }), /since/);
  await assert.rejects(() => repos.run(context(''), { since: 'daily', limit: 26 }), /limit/);
  await assert.rejects(
    () => repos.run(context('<main>Trending repositories</main>'), { since: 'daily', limit: 1 }),
    /parser drift/,
  );
  await assert.rejects(
    () => repos.run(context('<main>no trending repositories</main>'), { since: 'daily', limit: 1 }),
    /no repositories/,
  );
  await assert.rejects(() => repos.run(context('', 503), { since: 'daily', limit: 1 }), /HTTP 503/);
});
