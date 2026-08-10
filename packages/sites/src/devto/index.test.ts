import assert from 'node:assert/strict';
import test from 'node:test';
import latest from './commands/latest.js';
import read from './commands/read.js';
import tag from './commands/tag.js';
import top from './commands/top.js';
import user from './commands/user.js';

function context(requests: Array<{ url: string; query: unknown }>) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'devto-test',
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
      requests.push({ url: request.url, query: request.query });
      const body = request.url.includes('/articles/123')
        ? {
            id: 123,
            title: 'Article',
            user: { username: 'author' },
            public_reactions_count: 4,
            reading_time_minutes: 3,
            tag_list: ['typescript'],
            published_at: '2024-01-02T00:00:00Z',
            body_markdown: 'x'.repeat(120),
            url: 'https://dev.to/author/article-123',
          }
        : [
            {
              id: 123,
              title: 'Article',
              user: { username: 'author' },
              public_reactions_count: 4,
              comments_count: 2,
              reading_time_minutes: 3,
              tag_list: ['typescript'],
              published_at: '2024-01-02T00:00:00Z',
              url: 'https://dev.to/author/article-123',
            },
          ];
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

test('DEV.to commands map public listing and article APIs', async () => {
  const requests: Array<{ url: string; query: unknown }> = [];
  const runContext = context(requests);
  assert.equal(
    ((await latest.run(runContext, { limit: 10, page: 2 })) as Array<{ rank: number }>)[0]?.rank,
    11,
  );
  assert.equal(
    ((await top.run(runContext, { limit: 10 })) as unknown as Array<{ readingTime: number }>)[0]
      ?.readingTime,
    3,
  );
  assert.equal(
    ((await tag.run(runContext, { tag: 'typescript', limit: 10 })) as Array<{ tags: string }>)[0]
      ?.tags,
    'typescript',
  );
  assert.equal(
    (
      (await user.run(runContext, { username: 'author', limit: 10 })) as Array<{ author?: string }>
    )[0]?.author,
    undefined,
  );
  assert.equal(
    ((await read.run(runContext, { id: '123', 'max-length': 100 })) as Array<{ body: string }>)[0]
      ?.body.length,
    117,
  );
  assert.deepEqual(requests[0]?.query, [
    { name: 'per_page', value: '10' },
    { name: 'page', value: '2' },
  ]);
});

test('DEV.to validates ids, limits, and tags', async () => {
  await assert.rejects(
    () => read.run(context([]), { id: 'bad', 'max-length': 20_000 }),
    /not valid/,
  );
  await assert.rejects(() => latest.run(context([]), { limit: 101, page: 1 }), /<= 100/);
  await assert.rejects(
    () => read.run(context([]), { id: '123', 'max-length': 50 }),
    /at least 100/,
  );
  await assert.rejects(() => tag.run(context([]), { tag: '', limit: 20 }), /cannot be empty/);
});
