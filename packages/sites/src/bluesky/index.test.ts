import assert from 'node:assert/strict';
import test from 'node:test';
import feeds from './commands/feeds.js';
import followers from './commands/followers.js';
import following from './commands/following.js';
import profile from './commands/profile.js';
import search from './commands/search.js';
import starterPacks from './commands/starter-packs.js';
import thread from './commands/thread.js';
import trending from './commands/trending.js';
import user from './commands/user.js';

function context(requests: string[]) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'bluesky-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: Array<{ name: string; value: string }> }) => {
      const query = new URLSearchParams(
        request.query?.map(item => [item.name, item.value]),
      ).toString();
      requests.push(`${request.url}?${query}`);
      const body = request.url.includes('searchActors')
        ? {
            actors: [
              {
                handle: 'bsky.app',
                displayName: 'Bluesky',
                followersCount: 3,
                description: 'social',
              },
            ],
          }
        : request.url.includes('getProfile')
          ? {
              handle: 'bsky.app',
              displayName: 'Bluesky',
              followersCount: 3,
              followsCount: 4,
              postsCount: 5,
              description: 'social',
            }
          : request.url.includes('getFollowers')
            ? { followers: [{ handle: 'fan.test', displayName: 'Fan', description: 'hello' }] }
            : request.url.includes('getFollows')
              ? {
                  follows: [{ handle: 'friend.test', displayName: 'Friend', description: 'hello' }],
                }
              : request.url.includes('getPopularFeedGenerators')
                ? {
                    feeds: [
                      {
                        displayName: 'News',
                        likeCount: 8,
                        creator: { handle: 'creator.test' },
                        description: 'news',
                      },
                    ],
                  }
                : request.url.includes('getTrendingTopics')
                  ? { topics: [{ topic: 'open', link: 'https://bsky.app' }] }
                  : request.url.includes('getAuthorFeed')
                    ? {
                        feed: [
                          {
                            post: {
                              uri: 'at://post',
                              record: { text: 'hello' },
                              likeCount: 1,
                              repostCount: 2,
                              replyCount: 3,
                            },
                          },
                        ],
                      }
                    : request.url.includes('getPostThread')
                      ? {
                          thread: {
                            post: {
                              author: { handle: 'bsky.app' },
                              record: { text: 'root' },
                              likeCount: 1,
                              repostCount: 2,
                              replyCount: 1,
                            },
                            replies: [],
                          },
                        }
                      : {
                          starterPacks: [
                            {
                              record: { name: 'Pack', description: 'starter' },
                              listItemCount: 6,
                              joinedAllTimeCount: 7,
                            },
                          ],
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

test('Bluesky commands map all public OpenCLI endpoints', async () => {
  const requests: string[] = [];
  const runContext = context(requests);
  assert.equal((await search.run(runContext, { query: 'bsky', limit: 1 }))[0]?.handle, 'bsky.app');
  assert.equal((await profile.run(runContext, { handle: 'bsky.app' })).followers, 3);
  assert.equal(
    (await followers.run(runContext, { handle: 'bsky.app', limit: 1 }))[0]?.handle,
    'fan.test',
  );
  assert.equal(
    (await following.run(runContext, { handle: 'bsky.app', limit: 1 }))[0]?.handle,
    'friend.test',
  );
  assert.equal((await feeds.run(runContext, { limit: 1 }))[0]?.creator, 'creator.test');
  assert.equal((await trending.run(runContext, { limit: 1 }))[0]?.topic, 'open');
  assert.equal((await user.run(runContext, { handle: 'bsky.app', limit: 1 }))[0]?.text, 'hello');
  assert.equal(
    (await thread.run(runContext, { uri: 'at://post', limit: 1 }))[0]?.author,
    'bsky.app',
  );
  assert.equal(
    (await starterPacks.run(runContext, { handle: 'bsky.app', limit: 1 }))[0]?.members,
    6,
  );
  assert.equal(requests.length, 9);
});

test('Bluesky validates required arguments and limits', async () => {
  await assert.rejects(() => profile.run(context([]), { handle: '' }), /cannot be empty/);
  await assert.rejects(() => feeds.run(context([]), { limit: 0 }), /between 1 and/);
});
