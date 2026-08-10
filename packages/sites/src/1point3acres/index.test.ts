import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  inspectSite,
  SiteError,
  type BrowserFetchRequest,
  type FetchAdapterInvocationRequest,
  type SiteCommandContext,
  type SiteCommandDefinition,
} from '@panerelay/site-kit';
import digest from './commands/digest.js';
import forum from './commands/forum.js';
import forums from './commands/forums.js';
import hot from './commands/hot.js';
import latest from './commands/latest.js';
import notifications from './commands/notifications.js';
import thread from './commands/thread.js';
import user from './commands/user.js';
import { OnePointThreeAcresClient } from './client.js';

const commands: SiteCommandDefinition[] = [
  digest,
  forum,
  forums,
  hot,
  latest,
  notifications,
  thread,
  user,
];

function invocation(): FetchAdapterInvocationRequest {
  return {
    protocol: 'panerelay.fetch-adapter.v3',
    requestId: '1point3acres-test',
    operation: 'execute',
    command: 'test',
    args: {},
    fetch: {
      endpoint: 'http://127.0.0.1/fetch',
      token: 'test',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
}

function context(
  html: string,
  requests: BrowserFetchRequest[] = [],
  status = 200,
): SiteCommandContext {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: invocation(),
    async fetch(request) {
      requests.push(request);
      return {
        status,
        statusText: status === 200 ? 'OK' : 'Forbidden',
        headers: { 'content-type': 'text/html; charset=gbk' },
        body: Buffer.from(html, 'ascii').toString('base64'),
        bodyType: 'base64',
        url: request.url,
        redirected: false,
        attachedCookieCount: 1,
      };
    },
  };
}

const threadListing = `
<tbody id="normalthread_123">
  <tr>
    <th>
      <a href="forum-198-1.html" target="_blank">Jobs</a>
      <a class="s xst">Interview &#65;</a>
    </th>
    <td class="by"><cite><a>Alice</a></cite><em><span title="2026-08-10 10:00"></span></em></td>
    <td class="num"><a class="xi2">4</a><em>100</em></td>
    <td class="by"><cite><a>Bob</a></cite><em><span title="2026-08-10 11:00"></span></em></td>
  </tr>
</tbody>`;

test('1point3acres registers its fetch-compatible OpenCLI subset', async () => {
  const inspected = await inspectSite(
    fileURLToPath(new URL('../../src/1point3acres', import.meta.url)),
  );
  assert.deepEqual(
    inspected.manifest.commands.map(command => command.name).sort(),
    commands.map(command => command.name).sort(),
  );
});

test('hot decodes GBK bytes, reuses browser cookies, and maps Discuz rows', async () => {
  const requests: BrowserFetchRequest[] = [];
  const rows = (await hot.run(context(threadListing, requests), { limit: 1 })) as Array<{
    tid: string;
    title: string;
    replies: number;
    views: number;
  }>;
  assert.deepEqual(rows[0], {
    rank: 1,
    tid: '123',
    title: 'Interview A',
    forum: 'Jobs',
    author: 'Alice',
    replies: 4,
    views: 100,
    lastReplyTime: '2026-08-10 11:00',
    url: 'https://www.1point3acres.com/bbs/thread-123-1-1.html',
  });
  assert.equal(requests[0]?.responseType, 'base64');
  assert.equal(requests[0]?.withCookies, true);
});

test('forum and thread validate numeric identifiers and parse bounded content', async () => {
  await assert.rejects(
    () => forum.run(context(threadListing), { fid: 'jobs' }),
    /numeric forum ID/,
  );
  const threadHtml = `
    <div id="postlist"></div>
    <span id="thread_subject">Sample thread</span>
    <div id="post_10">
      <div class="authi"><a class="xi2">Alice</a><span title="2026-08-10 10:00"></span></div>
      <td id="postmessage_10">Hello<br>world</td>
    </div>`;
  const rows = (await thread.run(context(threadHtml), {
    tid: '123',
    limit: 1,
    'content-limit': 50,
  })) as Array<{ floor: number; pid: string; content: string }>;
  assert.equal(rows[0]?.floor, 1);
  assert.equal(rows[0]?.pid, '10');
  assert.equal(rows[0]?.content, '【Sample thread】\nHello\nworld');
});

test('forums deduplicates IDs and notifications classify empty results', async () => {
  const forumHtml = `
    <a href="forum-198-1.html" class="desktop overflow-hidden">Jobs</a>
    <a href="forum-198-1.html" class="desktop overflow-hidden">Jobs duplicate</a>`;
  assert.deepEqual(await forums.run(context(forumHtml), {}), [
    {
      fid: '198',
      name: 'Jobs',
      url: 'https://www.1point3acres.com/bbs/forum-198-1.html',
    },
  ]);
  await assert.rejects(
    () => notifications.run(context('暂时没有提醒内容'), {}),
    (error: unknown) => error instanceof SiteError && error.code === 'empty-result',
  );
});

test('Cloudflare responses fail with a retryable typed challenge', async () => {
  await assert.rejects(
    () => new OnePointThreeAcresClient(context('forbidden', [], 403)).html('forum.php'),
    (error: unknown) =>
      error instanceof SiteError && error.code === 'challenge-required' && error.retryable === true,
  );
});
