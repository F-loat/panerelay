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
import ask from './commands/ask.js';
import best from './commands/best.js';
import jobs from './commands/jobs.js';
import newStories from './commands/new.js';
import read from './commands/read.js';
import search from './commands/search.js';
import show from './commands/show.js';
import top from './commands/top.js';
import user from './commands/user.js';

const COMMANDS: SiteCommandDefinition[] = [
  ask,
  best,
  jobs,
  newStories,
  read,
  search,
  show,
  top,
  user,
];

function invocation(command: string): FetchAdapterInvocationRequest {
  return {
    protocol: 'panerelay.fetch-adapter.v3',
    requestId: command,
    operation: 'execute',
    command,
    args: {},
    fetch: {
      endpoint: 'http://127.0.0.1/fetch',
      token: 'test',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
}

function response(body: unknown, url: string): BrowserFetchResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body,
    bodyType: 'json',
    url,
    redirected: false,
    attachedCookieCount: 0,
  };
}

function context(command: string, handler: (request: BrowserFetchRequest) => unknown) {
  const request = invocation(command);
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: request,
    fetch: async (fetchRequest: BrowserFetchRequest) =>
      response(handler(fetchRequest), fetchRequest.url),
  };
}

test('Hacker News registers all OpenCLI commands', async () => {
  const value = await inspectSite(fileURLToPath(new URL('../../src/hackernews', import.meta.url)));
  assert.deepEqual(
    value.manifest.commands.map(command => command.name).sort(),
    COMMANDS.map(command => command.name).sort(),
  );
});

test('top filters dead stories and maps Firebase story fields', async () => {
  const rows = await top.run(
    context('top', request =>
      request.url.endsWith('/topstories.json')
        ? [1, 2]
        : request.url.endsWith('/item/1.json')
          ? {
              id: 1,
              title: 'Live',
              by: 'pg',
              score: 42,
              descendants: 3,
              url: 'https://example.com',
            }
          : { id: 2, title: 'Dead', dead: true },
    ),
    { limit: 2 },
  );
  assert.deepEqual(rows, [
    {
      rank: 1,
      id: 1,
      title: 'Live',
      score: 42,
      author: 'pg',
      comments: 3,
      url: 'https://example.com',
    },
  ]);
});

test('search maps Algolia fields and user converts creation date', async () => {
  const searchRows = await search.run(
    context('search', () => ({
      hits: [{ objectID: '9', title: 'Found', points: 7, author: 'pg', num_comments: 2, url: '' }],
    })),
    { query: 'found', limit: 1 },
  );
  assert.deepEqual(searchRows, [
    {
      rank: 1,
      id: '9',
      title: 'Found',
      score: 7,
      author: 'pg',
      comments: 2,
      url: 'https://news.ycombinator.com/item?id=9',
    },
  ]);
  const userRow = await user.run(
    context('user', () => ({ id: 'pg', karma: 10, created: 0, about: 'hello' })),
    { username: 'pg' },
  );
  assert.deepEqual(userRow, [{ username: 'pg', karma: 10, created: '', about: 'hello' }]);
});

test('read emits story, comments, and hidden reply markers', async () => {
  const items: Record<string, unknown> = {
    '1': { id: 1, title: 'Story', by: 'pg', score: 10, kids: [2] },
    '2': { id: 2, type: 'comment', by: 'sama', text: '<p>Hello</p>', kids: [3, 4] },
    '3': { id: 3, type: 'comment', by: 'reply', text: '<p>World</p>' },
  };
  const rows = await read.run(
    context(
      'read',
      request =>
        items[new URL(request.url).pathname.match(/item\/(\d+)\.json$/)?.[1] ?? ''] ?? null,
    ),
    { id: '1', limit: 5, depth: 2, replies: 1, 'max-length': 100 },
  );
  assert.deepEqual(rows, [
    { type: 'POST', author: 'pg', score: 10, text: 'Story' },
    { type: 'L0', author: 'sama', score: '', text: 'Hello' },
    { type: 'L1', author: 'reply', score: '', text: '  > World' },
    { type: 'L1', author: '', score: '', text: '  [+1 more replies]' },
  ]);
});
