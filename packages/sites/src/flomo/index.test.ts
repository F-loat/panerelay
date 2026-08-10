import assert from 'node:assert/strict';
import test from 'node:test';
import type { BrowserFetchRequest } from '@panerelay/protocol';
import type { SiteCommandContext } from '@panerelay/site-kit';
import { md5, memoRow, signedUrl } from './client.js';
import memos from './commands/memos.js';

test('implements MD5 and the stable Flomo signing input', () => {
  assert.equal(md5(''), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
  const url = new URL(signedUrl(20, 0, '', 1_700_000_000));
  assert.equal(url.searchParams.get('timestamp'), '1700000000');
  assert.match(url.searchParams.get('sign') ?? '', /^[a-f0-9]{32}$/);
});

test('normalizes memo fields', () => {
  assert.deepEqual(
    memoRow({
      slug: 'memo_1',
      content: ' hello ',
      tags: [{ name: 'work' }, 'idea'],
      files: [{ thumbnail_url: 'https://img/thumb' }, { url: 'https://img/full' }],
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    }),
    {
      id: 'memo_1',
      url: 'https://v.flomoapp.com/mine/?memo_id=memo_1',
      content: 'hello',
      slug: 'memo_1',
      tags: 'work, idea',
      images: 'https://img/thumb | https://img/full',
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    },
  );
});

test('requests memos with only the protected localStorage binding ID', async () => {
  let request: BrowserFetchRequest | undefined;
  const context: SiteCommandContext = {
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3',
      requestId: 'request',
      operation: 'execute',
      command: 'memos',
      args: { limit: 1 },
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'session',
        expiresAt: new Date(Date.now() + 1_000).toISOString(),
      },
    },
    artifact: () => {
      throw new Error('No artifact');
    },
    fetch: async input => {
      request = input;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: { code: 0, data: [{ slug: 'memo_1', content: 'hello' }] },
        bodyType: 'json',
        url: input.url,
        redirected: false,
        attachedCookieCount: 1,
      };
    },
  };
  const rows = (await memos.run(context, { limit: 1 })) as Array<{ id: string }>;
  assert.equal(rows[0]?.id, 'memo_1');
  assert.deepEqual(request?.bindings, ['flomo-access-token']);
  assert.equal(request?.headers?.Authorization, undefined);
});
