import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  BrowserFetchRequest,
  BrowserFetchResponse,
  FetchAdapterInvocationRequest,
  SiteCommandContext,
} from '@panerelay/site-kit';
import { parseCommentTarget, parseTarget } from './client.js';
import articleCreate from './commands/article-create.js';
import articleDelete from './commands/article-delete.js';
import articleDraft from './commands/article-draft.js';
import articleUpdate from './commands/article-update.js';
import commentDelete from './commands/comment-delete.js';
import download from './commands/download.js';
import site from './panerelay.site.js';

const ARTICLE_ID = '123456789';
const COMMENT_ID = '987654321';
const ME = { id: 'member-id', uid: 'member-uid', url_token: 'panerelay-user', name: 'User' };

function invocation(
  command: string,
  args: FetchAdapterInvocationRequest['args'] = {},
): FetchAdapterInvocationRequest {
  return {
    protocol: 'panerelay.fetch-adapter.v3',
    requestId: `request-${command}`,
    operation: 'execute',
    command,
    args,
    fetch: {
      endpoint: 'http://127.0.0.1:41234/fetch',
      token: 'fetch-session-secret-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
}

function response(
  body: unknown,
  url: string,
  status = 200,
  bodyType: BrowserFetchResponse['bodyType'] = 'json',
): BrowserFetchResponse {
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    headers: {},
    body,
    bodyType,
    url,
    redirected: false,
    attachedCookieCount: 1,
  };
}

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTICLE_ID,
    title: 'Current title',
    content: '<p>Current content</p>',
    state: 'draft',
    author: ME,
    can_reward: true,
    settings: { table_of_contents: { enabled: true } },
    created: 1_700_000_000,
    updated: 1_700_000_100,
    ...overrides,
  };
}

function context(
  command: string,
  args: FetchAdapterInvocationRequest['args'],
  requests: BrowserFetchRequest[],
  fetch: (request: BrowserFetchRequest) => Promise<BrowserFetchResponse>,
): SiteCommandContext {
  return {
    invocation: invocation(command, args),
    async fetch(request) {
      requests.push(request);
      return fetch(request);
    },
    artifact() {
      throw new Error('No artifact expected');
    },
  };
}

function body(request: BrowserFetchRequest): Record<string, unknown> {
  assert.equal(request.body?.encoding, 'utf8');
  return JSON.parse(request.body.data) as Record<string, unknown>;
}

test('Zhihu manifest and article command metadata expose the bounded draft surface', () => {
  assert.deepEqual(site.origins, ['https://www.zhihu.com', 'https://zhuanlan.zhihu.com']);
  assert.deepEqual(site.bindings?.[0]?.requestOrigins, [
    'https://www.zhihu.com',
    'https://zhuanlan.zhihu.com',
  ]);
  assert.deepEqual(
    [articleCreate, articleDraft, articleUpdate, articleDelete].map(command => [
      command.name,
      command.access,
    ]),
    [
      ['article-create', 'write'],
      ['article-draft', 'read'],
      ['article-update', 'write'],
      ['article-delete', 'write'],
    ],
  );
  assert.deepEqual([commentDelete.name, commentDelete.access], ['comment-delete', 'write']);
});

test('Zhihu article targets accept typed and canonical public URLs only', () => {
  assert.deepEqual(parseTarget(`article:${ARTICLE_ID}`), {
    kind: 'article',
    id: ARTICLE_ID,
    url: `https://zhuanlan.zhihu.com/p/${ARTICLE_ID}`,
  });
  assert.deepEqual(parseTarget(`https://zhuanlan.zhihu.com/p/${ARTICLE_ID}`), {
    kind: 'article',
    id: ARTICLE_ID,
    url: `https://zhuanlan.zhihu.com/p/${ARTICLE_ID}`,
  });
  assert.throws(
    () => parseTarget(`https://zhuanlan.zhihu.com/p/${ARTICLE_ID}/edit`),
    /supported Zhihu HTTPS URL/,
  );
});

test('Zhihu comment targets preserve the numeric comment identity', () => {
  const expected = {
    kind: 'comment',
    id: COMMENT_ID,
    url: `https://www.zhihu.com/api/v4/comments/${COMMENT_ID}`,
  };
  assert.deepEqual(parseCommentTarget(COMMENT_ID), expected);
  assert.deepEqual(parseCommentTarget(`comment:${COMMENT_ID}`), expected);
  assert.deepEqual(
    parseCommentTarget(`https://www.zhihu.com/question/123/answer/456#comment-${COMMENT_ID}`),
    expected,
  );
  assert.throws(() => parseCommentTarget('https://example.com/#comment-1'), /zhihu comment must/);
});

test('article-create requires execute before issuing any request', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { title: 'Title', content: '<p>Body</p>' };
  await assert.rejects(
    articleCreate.run(
      context('article-create', args, requests, async request => response({}, request.url)),
      args,
    ),
    /requires --execute/,
  );
  assert.equal(requests.length, 0);
});

test('article-create uses the editor origin, xsrf binding, and read-back ownership check', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { title: 'New title', content: '<p>New content</p>', execute: true };
  const result = await articleCreate.run(
    context('article-create', args, requests, async request => {
      const pathname = new URL(request.url).pathname;
      if (pathname === '/api/v4/me') return response(ME, request.url);
      if (pathname === '/api/articles/drafts') return response({ id: ARTICLE_ID }, request.url);
      if (pathname === `/api/articles/${ARTICLE_ID}/draft`) {
        return response(draft({ title: args.title, content: args.content }), request.url);
      }
      throw new Error(`Unexpected request: ${request.url}`);
    }),
    args,
  );
  assert.equal(requests.length, 3);
  const create = requests[1]!;
  assert.equal(create.method, 'POST');
  assert.equal(create.url, 'https://zhuanlan.zhihu.com/api/articles/drafts');
  assert.deepEqual(create.bindings, ['zhihu-xsrf']);
  assert.equal(create.withCookies, true);
  assert.deepEqual(body(create), {
    title: args.title,
    content: args.content,
    delta_time: 1,
    table_of_contents: false,
  });
  assert.equal((result as Array<Record<string, unknown>>)[0]?.id, ARTICLE_ID);
});

test('article-draft rejects an ownership mismatch', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { target: `article:${ARTICLE_ID}` };
  await assert.rejects(
    articleDraft.run(
      context('article-draft', args, requests, async request => {
        const pathname = new URL(request.url).pathname;
        if (pathname === '/api/v4/me') return response(ME, request.url);
        return response(draft({ author: { url_token: 'another-user' } }), request.url);
      }),
      args,
    ),
    /not owned by the signed-in account/,
  );
  assert.equal(requests.length, 2);
});

test('article-update preserves omitted content and verifies the replacement', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { target: `article:${ARTICLE_ID}`, title: 'Replacement', execute: true };
  let updated = false;
  const result = await articleUpdate.run(
    context('article-update', args, requests, async request => {
      const pathname = new URL(request.url).pathname;
      if (pathname === '/api/v4/me') return response(ME, request.url);
      if (request.method === 'PATCH') {
        updated = true;
        return response({}, request.url);
      }
      return response(draft(updated ? { title: args.title } : {}), request.url);
    }),
    args,
  );
  const patchRequest = requests.find(request => request.method === 'PATCH');
  assert.ok(patchRequest);
  assert.deepEqual(body(patchRequest), {
    title: args.title,
    content: '<p>Current content</p>',
    delta_time: 1,
    table_of_contents: true,
    can_reward: true,
  });
  assert.equal((result as Array<Record<string, unknown>>)[0]?.title, args.title);
});

test('article-update rejects an empty change set before any mutation', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { target: `article:${ARTICLE_ID}`, execute: true };
  await assert.rejects(
    articleUpdate.run(
      context('article-update', args, requests, async request => response({}, request.url)),
      args,
    ),
    /requires --title or --content/,
  );
  assert.equal(requests.length, 0);
});

test('article-update rejects another author before PATCH', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = {
    target: `article:${ARTICLE_ID}`,
    title: 'Replacement',
    execute: true,
  };
  await assert.rejects(
    articleUpdate.run(
      context('article-update', args, requests, async request => {
        if (new URL(request.url).pathname === '/api/v4/me') return response(ME, request.url);
        return response(draft({ author: { url_token: 'another-user' } }), request.url);
      }),
      args,
    ),
    /not owned by the signed-in account/,
  );
  assert.equal(
    requests.some(request => request.method === 'PATCH'),
    false,
  );
});

test('article-delete rejects a published article before DELETE', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { target: `article:${ARTICLE_ID}`, execute: true };
  await assert.rejects(
    articleDelete.run(
      context('article-delete', args, requests, async request => {
        if (new URL(request.url).pathname === '/api/v4/me') return response(ME, request.url);
        return response(draft({ state: 'published' }), request.url);
      }),
      args,
    ),
    /only supports private drafts/,
  );
  assert.equal(
    requests.some(request => request.method === 'DELETE'),
    false,
  );
});

test('article-delete uses DELETE and verifies the private draft is absent', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { target: `article:${ARTICLE_ID}`, execute: true };
  let deleted = false;
  const result = await articleDelete.run(
    context('article-delete', args, requests, async request => {
      const pathname = new URL(request.url).pathname;
      if (pathname === '/api/v4/me') return response(ME, request.url);
      if (request.method === 'DELETE') {
        deleted = true;
        return response('', request.url, 204, 'text');
      }
      return deleted
        ? response({}, request.url, 404)
        : response(draft({ state: 'draft' }), request.url);
    }),
    args,
  );
  const deleteRequest = requests.find(request => request.method === 'DELETE');
  assert.ok(deleteRequest);
  assert.deepEqual(deleteRequest.bindings, ['zhihu-xsrf']);
  assert.equal((result as Array<Record<string, unknown>>)[0]?.id, ARTICLE_ID);
});

test('article-draft fails closed on a malformed response', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { target: `article:${ARTICLE_ID}` };
  await assert.rejects(
    articleDraft.run(
      context('article-draft', args, requests, async request => {
        if (new URL(request.url).pathname === '/api/v4/me') return response(ME, request.url);
        return response({ id: ARTICLE_ID, author: ME }, request.url);
      }),
      args,
    ),
    /response is malformed/,
  );
});

test('download reads a public article from the editor origin and returns Markdown', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { url: `https://zhuanlan.zhihu.com/p/${ARTICLE_ID}` };
  const result = await download.run(
    context('download', args, requests, async request =>
      response(
        {
          id: ARTICLE_ID,
          title: 'Public title',
          content: '<h2>Heading</h2><p>Body</p>',
          author: ME,
          created: 1_700_000_000,
          state: 'published',
        },
        request.url,
      ),
    ),
    args,
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, `https://zhuanlan.zhihu.com/api/articles/${ARTICLE_ID}`);
  assert.match(String((result as Array<Record<string, unknown>>)[0]?.markdown), /## Heading/);
});

test('comment-delete requires execute before issuing any request', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { target: `comment:${COMMENT_ID}` };
  await assert.rejects(
    commentDelete.run(
      context('comment-delete', args, requests, async request => response({}, request.url)),
      args,
    ),
    /requires --execute/,
  );
  assert.equal(requests.length, 0);
});

test('comment-delete rejects another author before DELETE', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { target: `comment:${COMMENT_ID}`, execute: true };
  await assert.rejects(
    commentDelete.run(
      context('comment-delete', args, requests, async request => {
        if (new URL(request.url).pathname === '/api/v4/me') return response(ME, request.url);
        return response(
          { id: COMMENT_ID, author: { member: { url_token: 'another-user' } } },
          request.url,
        );
      }),
      args,
    ),
    /not owned by the signed-in account/,
  );
  assert.equal(
    requests.some(request => request.method === 'DELETE'),
    false,
  );
});

test('comment-delete deletes an owned comment and verifies its absence', async () => {
  const requests: BrowserFetchRequest[] = [];
  const args = { target: `comment:${COMMENT_ID}`, execute: true };
  let deleted = false;
  let initialReads = 0;
  let readbacks = 0;
  const result = await commentDelete.run(
    context('comment-delete', args, requests, async request => {
      if (new URL(request.url).pathname === '/api/v4/me') return response(ME, request.url);
      if (request.method === 'DELETE') {
        deleted = true;
        return response('', request.url, 204, 'text');
      }
      if (!deleted) {
        initialReads += 1;
        return initialReads === 1
          ? response({}, request.url, 500)
          : response({ id: COMMENT_ID, author: { member: ME } }, request.url);
      }
      readbacks += 1;
      return readbacks === 1
        ? response({ id: COMMENT_ID, author: { member: ME } }, request.url)
        : response({}, request.url, 404);
    }),
    args,
  );
  const deleteRequest = requests.find(request => request.method === 'DELETE');
  assert.ok(deleteRequest);
  assert.equal(deleteRequest.url, `https://www.zhihu.com/api/v4/comment_v5/comment/${COMMENT_ID}`);
  assert.deepEqual(deleteRequest.bindings, ['zhihu-xsrf']);
  assert.equal(initialReads, 2);
  assert.equal(readbacks, 2);
  assert.equal((result as Array<Record<string, unknown>>)[0]?.id, COMMENT_ID);
});
