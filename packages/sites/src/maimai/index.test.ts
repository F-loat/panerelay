import assert from 'node:assert/strict';
import test from 'node:test';
import type { SiteCommandContext } from '@panerelay/site-kit';
import whoami from './commands/whoami.js';

test('whoami resolves current same-origin Next data and maps the signed-in account', async () => {
  const requests: string[] = [];
  const context: SiteCommandContext = {
    artifact: () => assert.fail('whoami does not use artifacts'),
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3',
      requestId: 'request',
      operation: 'execute',
      command: 'whoami',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test-token',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async request => {
      requests.push(request.url);
      if (requests.length === 1) {
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/html' },
          body: '<script id="__NEXT_DATA__" type="application/json">{"buildId":"build_123","assetPrefix":"https://s.taou.com/n/platform"}</script>',
          bodyType: 'text',
          url: request.url,
          redirected: false,
          attachedCookieCount: 1,
        };
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: {
          user: { id: 42, realname: 'Fixture User', company: 'Fixture Company' },
          result: 'ok',
        },
        bodyType: 'json',
        url: request.url,
        redirected: false,
        attachedCookieCount: 1,
      };
    },
  };

  assert.deepEqual(await whoami.run(context), [
    {
      logged_in: true,
      site: 'maimai',
      user_id: '42',
      name: 'Fixture User',
      company: 'Fixture Company',
    },
  ]);
  assert.deepEqual(requests, [
    'https://maimai.cn/',
    'https://maimai.cn/n/platform/_next/data/build_123/api/auth/get_user.json',
  ]);
});
