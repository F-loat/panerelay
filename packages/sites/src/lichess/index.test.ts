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
import top from './commands/top.js';
import user from './commands/user.js';

const COMMANDS: SiteCommandDefinition[] = [top, user];
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
function context(handler: (request: BrowserFetchRequest) => unknown) {
  const invocation: FetchAdapterInvocationRequest = {
    protocol: 'panerelay.fetch-adapter.v3',
    requestId: 'lichess-test',
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

test('Lichess registers public user and top commands', async () => {
  const value = await inspectSite(fileURLToPath(new URL('../../src/lichess', import.meta.url)));
  assert.deepEqual(
    value.manifest.commands.map(command => command.name).sort(),
    COMMANDS.map(command => command.name).sort(),
  );
});
test('user maps counts, profile, and most-played performance', async () => {
  const rows = await user.run(
    context(() => ({
      id: 'pg',
      username: 'Player',
      createdAt: 1700000000000,
      count: { all: 10, win: 6, loss: 3, draw: 1 },
      profile: { fideRating: 2200, country: 'US', bio: ' hello ' },
      perfs: {
        blitz: { games: 9, rating: 2100 },
        bullet: { games: 20, rating: 2300 },
        puzzle: { games: 999, rating: 3000 },
      },
    })),
    { username: 'Player' },
  );
  assert.deepEqual(rows, [
    {
      username: 'Player',
      id: 'pg',
      title: null,
      patron: false,
      online: false,
      tosViolation: false,
      createdAt: '2023-11-14T22:13:20.000Z',
      seenAt: null,
      gamesAll: 10,
      gamesWin: 6,
      gamesLoss: 3,
      gamesDraw: 1,
      topPerfName: 'bullet',
      topPerfRating: 2300,
      topPerfGames: 20,
      fideRating: 2200,
      country: 'US',
      bio: 'hello',
      url: 'https://lichess.org/@/Player',
    },
  ]);
});
test('top maps performance rating and validates inputs', async () => {
  const rows = await top.run(
    context(() => ({
      users: [
        {
          id: 'm',
          username: 'Magnus',
          title: 'GM',
          patron: true,
          perfs: { blitz: { rating: 3001, progress: 7 } },
        },
      ],
    })),
    { perf: 'blitz', limit: 3 },
  );
  assert.deepEqual(rows, [
    {
      rank: 1,
      username: 'Magnus',
      id: 'm',
      title: 'GM',
      rating: 3001,
      progress: 7,
      patron: true,
      url: 'https://lichess.org/@/Magnus/perf/blitz',
    },
  ]);
  let calls = 0;
  const ctx = context(() => {
    calls += 1;
    return {};
  });
  await assert.rejects(() => user.run(ctx, { username: 'a' }));
  await assert.rejects(() => top.run(ctx, { perf: 'turbo' }));
  assert.equal(calls, 0);
});
