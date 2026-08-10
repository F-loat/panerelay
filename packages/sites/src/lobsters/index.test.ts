import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type {
  BrowserFetchRequest,
  BrowserFetchResponse,
  FetchAdapterInvocationRequest,
  SiteCommandDefinition,
} from '@panerelay/site-kit';
import { inspectSite } from '@panerelay/site-kit';
import active from './commands/active.js';
import domain from './commands/domain.js';
import hot from './commands/hot.js';
import newest from './commands/newest.js';
import read from './commands/read.js';
import tag from './commands/tag.js';

const COMMANDS: SiteCommandDefinition[] = [active, domain, hot, newest, read, tag];
function response(body: unknown, url: string, status = 200): BrowserFetchResponse {
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    headers: { 'content-type': 'application/json' },
    body,
    bodyType: 'json',
    url,
    redirected: false,
    attachedCookieCount: 0,
  };
}
function context(handler: (request: BrowserFetchRequest) => unknown) {
  const invocation: FetchAdapterInvocationRequest = {
    protocol: 'panerelay.fetch-adapter.v3',
    requestId: 'lobsters-test',
    operation: 'execute',
    command: 'test',
    args: {},
    fetch: {
      endpoint: 'http://127.0.0.1/fetch',
      token: 'test',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation,
    fetch: async (request: BrowserFetchRequest) => response(handler(request), request.url),
  };
}

test('Lobste.rs registers all public commands', async () => {
  const value = await inspectSite(fileURLToPath(new URL('../../src/lobsters', import.meta.url)));
  assert.deepEqual(
    value.manifest.commands.map(command => command.name).sort(),
    COMMANDS.map(command => command.name).sort(),
  );
});
test('listing commands map story fields and encode tag/domain paths', async () => {
  const item = {
    short_id: 'abc',
    title: 'Story',
    score: 7,
    submitter_user: 'pg',
    comment_count: 2,
    created_at: '2026-08-09T00:00:00Z',
    tags: ['rust', 'programming'],
    comments_url: 'https://lobste.rs/s/abc',
  };
  for (const command of [hot, active, newest])
    assert.deepEqual(
      await command.run(
        context(() => [item]),
        { limit: 1 },
      ),
      [
        {
          rank: 1,
          id: 'abc',
          title: 'Story',
          score: 7,
          author: 'pg',
          comments: 2,
          created_at: item.created_at,
          tags: 'rust, programming',
          url: item.comments_url,
        },
      ],
    );
  const requests: string[] = [];
  await tag.run(
    context(request => {
      requests.push(request.url);
      return [item];
    }),
    { tag: 'Rust', limit: 1 },
  );
  await domain.run(
    context(request => {
      requests.push(request.url);
      return [item];
    }),
    { domain: 'github.com', limit: 1 },
  );
  assert.deepEqual(requests, [
    'https://lobste.rs/t/rust.json',
    'https://lobste.rs/domains/github.com.json',
  ]);
});
test('listing and read validate arguments before fetching', async () => {
  let calls = 0;
  const ctx = context(() => {
    calls += 1;
    return [];
  });
  await assert.rejects(() => tag.run(ctx, { tag: 'bad tag' }));
  await assert.rejects(() => domain.run(ctx, { domain: 'localhost' }));
  await assert.rejects(() => read.run(ctx, { id: 'BAD!', 'max-length': 99 }));
  assert.equal(calls, 0);
});
test('read maps the story and threaded comments with hidden reply markers', async () => {
  const story = {
    short_id: 'abc',
    title: 'Hello',
    url: 'https://example.com',
    score: 4,
    submitter_user: 'pg',
    description_plain: 'Intro',
    comments: [
      {
        short_id: 'top',
        parent_comment: null,
        score: 2,
        commenting_user: 'alice',
        comment_plain: 'Top',
      },
      {
        short_id: 'reply',
        parent_comment: 'top',
        score: 1,
        commenting_user: 'bob',
        comment_plain: 'Reply',
      },
      {
        short_id: 'hidden',
        parent_comment: 'top',
        score: 1,
        commenting_user: 'eve',
        comment_plain: 'Hidden',
      },
    ],
  };
  const rows = await read.run(
    context(() => story),
    { id: 'abc', limit: 5, depth: 1, replies: 1, 'max-length': 2000 },
  );
  assert.deepEqual(rows, [
    { type: 'POST', author: 'pg', score: 4, text: 'Hello\nIntro\nhttps://example.com' },
    { type: 'L0', author: 'alice', score: 2, text: 'Top' },
    { type: 'L1', author: '', score: '', text: '  [+2 more replies]' },
  ]);
});
