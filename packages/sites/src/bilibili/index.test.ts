import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  type BrowserFetchRequest,
  type BrowserFetchResponse,
  type FetchAdapterInvocationRequest,
  inspectSite,
  type SiteCommandDefinition,
} from '@panerelay/site-kit';
import { createBilibiliTestContext, type BilibiliAdapterDependencies } from './client.js';
import comment from './commands/comment.js';
import comments from './commands/comments.js';
import dynamic from './commands/dynamic.js';
import favorite from './commands/favorite.js';
import feedDetail from './commands/feed-detail.js';
import feed from './commands/feed.js';
import follow from './commands/follow.js';
import following from './commands/following.js';
import history from './commands/history.js';
import hot from './commands/hot.js';
import me from './commands/me.js';
import ranking from './commands/ranking.js';
import search from './commands/search.js';
import subtitle from './commands/subtitle.js';
import summary from './commands/summary.js';
import unfollow from './commands/unfollow.js';
import userVideos from './commands/user-videos.js';
import video from './commands/video.js';
import whoami from './commands/whoami.js';
import { signWbiQuery } from './commands/_shared/wbi.js';

const COMMANDS: SiteCommandDefinition[] = [
  comment,
  comments,
  dynamic,
  favorite,
  feedDetail,
  feed,
  follow,
  following,
  history,
  hot,
  me,
  ranking,
  search,
  subtitle,
  summary,
  unfollow,
  userVideos,
  video,
  whoami,
];
const BILIBILI_COMMAND_NAMES = COMMANDS.map(command => command.name).sort();

async function executeBilibiliCommand(
  request: FetchAdapterInvocationRequest,
  dependencies: BilibiliAdapterDependencies,
): Promise<unknown> {
  const command = COMMANDS.find(candidate => candidate.name === request.command);
  if (!command) throw new Error(`Unknown Bilibili command: ${request.command}`);
  return command.run(createBilibiliTestContext(request, dependencies), request.args);
}

const IMG_KEY = 'abcdefghijklmnopqrstuvwxyz123456';
const SUB_KEY = '654321zyxwvutsrqponmlkjihgfedcba';

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

function jsonResponse(body: unknown, url = 'https://api.bilibili.com/'): BrowserFetchResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body,
    bodyType: 'json',
    url,
    redirected: false,
    attachedCookieCount: 2,
  };
}

function query(request: BrowserFetchRequest): Record<string, string> {
  return Object.fromEntries((request.query ?? []).map(entry => [entry.name, entry.value]));
}

function dynamicItem(): Record<string, unknown> {
  return {
    id_str: '9001',
    type: 'DYNAMIC_TYPE_AV',
    modules: {
      module_author: { name: 'Alice', pub_time: '刚刚' },
      module_dynamic: {
        desc: { text: '<b>动态正文</b>' },
        major: {
          archive: {
            title: 'Video title',
            desc: 'Video description',
            jump_url: '//www.bilibili.com/video/BV1test',
            stat: { play: 12, danmaku: 3 },
          },
        },
      },
      module_stat: {
        like: { count: 5 },
        comment: { count: 2 },
        forward: { count: 1 },
      },
    },
  };
}

function fixtureFetch(
  requests: BrowserFetchRequest[],
  relationAttributes: number[] = [],
): (request: BrowserFetchRequest) => Promise<BrowserFetchResponse> {
  return async request => {
    requests.push(request);
    const url = new URL(request.url);
    const params = query(request);

    if (url.hostname === 'subtitle.example') {
      return jsonResponse({ body: [{ from: 1.25, to: 2.5, content: '字幕' }] }, request.url);
    }
    if (url.hostname === 'b23.tv') {
      return {
        ...jsonResponse('', 'https://www.bilibili.com/video/BV1test'),
        body: '',
        bodyType: 'text',
        redirected: true,
      };
    }

    switch (url.pathname) {
      case '/x/web-interface/nav':
        return jsonResponse({
          code: 0,
          data: {
            mid: 123456,
            wbi_img: {
              img_url: `https://i0.hdslb.com/bfs/wbi/${IMG_KEY}.png`,
              sub_url: `https://i0.hdslb.com/bfs/wbi/${SUB_KEY}.png`,
            },
          },
        });
      case '/x/space/wbi/acc/info':
        return jsonResponse({
          code: 0,
          data: {
            mid: Number(params.mid),
            name: 'Panerelay User',
            level: 6,
            coins: 42.5,
            follower: 100,
            following: 23,
          },
        });
      case '/x/web-interface/view':
        return jsonResponse({
          code: 0,
          data: {
            bvid: params.bvid,
            aid: 11,
            cid: 22,
            title: 'Fixture video',
            duration: 60,
            videos: 1,
            owner: { mid: 2, name: 'Uploader' },
            stat: { view: 10, danmaku: 2, reply: 1, like: 3, coin: 4, favorite: 5, share: 6 },
            rights: {},
            pages: [{ page: 1, cid: 22, part: 'P1', duration: 60 }],
          },
        });
      case '/x/web-interface/wbi/search/type':
        return jsonResponse({
          code: 0,
          data: {
            result:
              params.search_type === 'bili_user'
                ? [{ mid: 2, uname: 'Target', usign: 'bio', fans: 7 }]
                : [{ bvid: 'BV1test', title: '<em>Fixture</em>', author: 'Uploader', play: 8 }],
          },
        });
      case '/x/web-interface/popular':
      case '/x/web-interface/ranking/v2':
        return jsonResponse({
          code: 0,
          data: {
            list: [
              {
                bvid: 'BV1test',
                title: 'Popular',
                owner: { name: 'Uploader' },
                stat: { view: 10, danmaku: 2 },
              },
            ],
          },
        });
      case '/x/polymer/web-dynamic/v1/feed/all':
      case '/x/polymer/web-dynamic/v1/feed/space':
        return jsonResponse({ code: 0, data: { items: [dynamicItem()], has_more: false } });
      case '/x/polymer/web-dynamic/v1/detail':
        return jsonResponse({ code: 0, data: { item: dynamicItem() } });
      case '/x/v3/fav/resource/list':
        return jsonResponse({
          code: 0,
          data: {
            medias: [
              {
                bvid: 'BV1test',
                title: 'Favorite',
                upper: { name: 'Uploader' },
                cnt_info: { play: 10 },
              },
            ],
          },
        });
      case '/x/web-interface/history/cursor':
        return jsonResponse({
          code: 0,
          data: {
            list: [
              {
                title: 'History',
                author_name: 'Uploader',
                progress: 30,
                duration: 60,
                history: { bvid: 'BV1test' },
              },
            ],
          },
        });
      case '/x/relation/followings':
        return jsonResponse({
          code: 0,
          data: {
            total: 1,
            list: [
              {
                mid: 2,
                uname: 'Target',
                sign: 'bio',
                attribute: 2,
                official_verify: { desc: '' },
              },
            ],
          },
        });
      case '/x/space/wbi/arc/search':
        return jsonResponse({
          code: 0,
          data: {
            list: {
              vlist: [
                { bvid: 'BV1test', title: 'Upload', play: 10, like: 2, created: 1_700_000_000 },
              ],
            },
          },
        });
      case '/x/v2/reply/main':
      case '/x/v2/reply/reply':
        return jsonResponse({
          code: 0,
          data: {
            replies: [
              {
                rpid: 33,
                member: { uname: 'Commenter' },
                content: { message: 'hello' },
                like: 1,
                rcount: 0,
                ctime: 1_700_000_000,
              },
            ],
          },
        });
      case '/x/player/wbi/v2':
        return jsonResponse({
          code: 0,
          data: {
            subtitle: {
              subtitles: [{ lan: 'zh-CN', subtitle_url: 'https://subtitle.example/subtitle.json' }],
            },
          },
        });
      case '/x/web-interface/view/conclusion/get':
        return jsonResponse({
          code: 0,
          data: {
            code: 0,
            model_result: {
              summary: 'Summary',
              outline: [
                {
                  timestamp: 5,
                  title: 'Section',
                  part_outline: [{ timestamp: 6, content: 'Point' }],
                },
              ],
            },
          },
        });
      case '/x/relation':
        return jsonResponse({ code: 0, data: { attribute: relationAttributes.shift() ?? 0 } });
      case '/x/v2/reply/add':
        return jsonResponse({ code: 0, data: { rpid: 44 } });
      case '/x/relation/modify':
        return jsonResponse({ code: 0, data: {} });
      default:
        throw new Error(`Unhandled fixture request: ${request.method ?? 'GET'} ${request.url}`);
    }
  };
}

test('manifest and executable command registry expose the same 19 OpenCLI-compatible commands', async () => {
  const sourceDirectory = fileURLToPath(new URL('../../src/bilibili', import.meta.url));
  const value = await inspectSite(sourceDirectory);
  const commands = value.manifest.commands;
  const names = commands.map(command => command.name).sort();

  assert.deepEqual(names, BILIBILI_COMMAND_NAMES);
  assert.equal(names.length, 19);
  assert.equal(commands.filter(command => command.access === 'read').length, 16);
  assert.equal(commands.filter(command => command.access === 'write').length, 3);
  assert.equal(names.includes('login'), false);
  assert.equal(names.includes('download'), false);
});

test('all 16 read commands execute against their expected Bilibili API fixtures', async () => {
  const cases: Array<{
    command: string;
    args?: FetchAdapterInvocationRequest['args'];
    path: string;
  }> = [
    { command: 'whoami', path: '/x/space/wbi/acc/info' },
    { command: 'me', path: '/x/space/wbi/acc/info' },
    { command: 'video', args: { bvid: 'BV1test' }, path: '/x/web-interface/view' },
    { command: 'search', args: { query: 'fixture' }, path: '/x/web-interface/wbi/search/type' },
    { command: 'hot', path: '/x/web-interface/popular' },
    { command: 'ranking', path: '/x/web-interface/ranking/v2' },
    { command: 'dynamic', path: '/x/polymer/web-dynamic/v1/feed/all' },
    { command: 'feed', path: '/x/polymer/web-dynamic/v1/feed/all' },
    { command: 'feed-detail', args: { id: '9001' }, path: '/x/polymer/web-dynamic/v1/detail' },
    { command: 'favorite', args: { fid: 9 }, path: '/x/v3/fav/resource/list' },
    { command: 'history', path: '/x/web-interface/history/cursor' },
    { command: 'following', args: { uid: '2' }, path: '/x/relation/followings' },
    { command: 'user-videos', args: { uid: '2' }, path: '/x/space/wbi/arc/search' },
    { command: 'comments', args: { bvid: 'BV1test' }, path: '/x/v2/reply/main' },
    { command: 'subtitle', args: { bvid: 'BV1test', lang: 'zh-CN' }, path: '/x/player/wbi/v2' },
    { command: 'summary', args: { bvid: 'BV1test' }, path: '/x/web-interface/view/conclusion/get' },
  ];

  for (const item of cases) {
    const requests: BrowserFetchRequest[] = [];
    const result = await executeBilibiliCommand(invocation(item.command, item.args), {
      now: () => 1_700_000_000_000,
      browserFetch: fixtureFetch(requests),
    });
    assert.ok(Array.isArray(result) ? result.length > 0 : result && typeof result === 'object');
    assert.ok(
      requests.some(request => new URL(request.url).pathname === item.path),
      `${item.command} did not request ${item.path}`,
    );
  }
});

test('me uses nav-derived WBI signing and exact output fields', async () => {
  const requests: BrowserFetchRequest[] = [];
  const result = await executeBilibiliCommand(invocation('me'), {
    now: () => 1_700_000_000_000,
    browserFetch: fixtureFetch(requests),
  });

  assert.deepEqual(result, {
    name: 'Panerelay User',
    uid: '123456',
    level: 6,
    coins: 42.5,
    followers: 100,
    following: 23,
  });
  const profileRequest = requests.find(
    request => new URL(request.url).pathname === '/x/space/wbi/acc/info',
  );
  assert.ok(profileRequest);
  assert.deepEqual(profileRequest.headers, {
    Origin: 'https://www.bilibili.com',
    Referer: 'https://www.bilibili.com/',
  });
  assert.equal(profileRequest.withCookies, true);
  assert.equal(query(profileRequest).mid, '123456');
  assert.equal(query(profileRequest).wts, '1700000000');
  assert.match(query(profileRequest).w_rid ?? '', /^[a-f0-9]{32}$/);
});

test('comment refuses to mutate without --execute', async () => {
  const requests: BrowserFetchRequest[] = [];
  await assert.rejects(
    executeBilibiliCommand(invocation('comment', { bvid: 'BV1test', message: 'hello' }), {
      browserFetch: fixtureFetch(requests),
    }),
    /pass --execute/,
  );
  assert.deepEqual(requests, []);
});

test('comment declares a generic bili_jct form binding without reading or serializing its value', async () => {
  const requests: BrowserFetchRequest[] = [];
  const result = await executeBilibiliCommand(
    invocation('comment', { bvid: 'BV1test', message: 'hello', execute: true }),
    { browserFetch: fixtureFetch(requests) },
  );
  assert.deepEqual(result, [
    {
      rpid: '44',
      bvid: 'BV1test',
      oid: '11',
      message: 'hello',
      url: 'https://www.bilibili.com/video/BV1test#reply44',
    },
  ]);
  const post = requests.find(request => new URL(request.url).pathname === '/x/v2/reply/add');
  assert.ok(post);
  assert.deepEqual(post.bindings, ['bilibili-csrf']);
  assert.equal(post.body?.encoding, 'utf8');
  assert.equal(post.body?.data.includes('csrf='), false);
  assert.equal(JSON.stringify(post).includes('fetch-session-secret-token'), false);
});

test('follow and unfollow use CSRF-bound writes and verify the resulting relation', async () => {
  for (const item of [
    { command: 'follow', attributes: [0, 2], act: '1', status: 'followed' },
    { command: 'unfollow', attributes: [2, 0], act: '2', status: 'unfollowed' },
  ]) {
    const requests: BrowserFetchRequest[] = [];
    const result = await executeBilibiliCommand(invocation(item.command, { target: '2' }), {
      browserFetch: fixtureFetch(requests, [...item.attributes]),
      sleep: async () => {},
    });
    assert.deepEqual(result, [
      {
        mid: '2',
        name: '',
        status: item.status,
        url: 'https://space.bilibili.com/2',
      },
    ]);
    const post = requests.find(request => new URL(request.url).pathname === '/x/relation/modify');
    assert.ok(post);
    assert.deepEqual(post.bindings, ['bilibili-csrf']);
    assert.equal(post.body?.encoding, 'utf8');
    assert.equal(new URLSearchParams(post.body?.data).get('act'), item.act);
    assert.equal(new URLSearchParams(post.body?.data).has('csrf'), false);
  }
});

test('short b23.tv inputs resolve through the browser fetch response URL', async () => {
  const requests: BrowserFetchRequest[] = [];
  await executeBilibiliCommand(invocation('video', { bvid: 'b23.tv/abc' }), {
    browserFetch: fixtureFetch(requests),
  });
  assert.equal(requests[0]?.url, 'https://b23.tv/abc');
  assert.equal(requests[0]?.withCookies, false);
});

test('feed returns an empty list when the API page is empty', async () => {
  const result = await executeBilibiliCommand(invocation('feed'), {
    browserFetch: async () => jsonResponse({ code: 0, data: { items: [], has_more: false } }),
  });
  assert.deepEqual(result, []);
});

test('WBI signing is deterministic and sanitizes forbidden values', () => {
  const signed = signWbiQuery({ mid: '1', value: "a!b(c)*d'e" }, IMG_KEY, SUB_KEY, 1_700_000_000);
  assert.equal(signed.value, 'abcde');
  assert.equal(signed.w_rid, '4435ed454de2ad7db34cb85ab189b70d');
});

test('fails closed when Bilibili is logged out', async () => {
  await assert.rejects(
    executeBilibiliCommand(invocation('me'), {
      browserFetch: async () => jsonResponse({ code: 0, data: { mid: 0 } }),
    }),
    /login is required/,
  );
});
