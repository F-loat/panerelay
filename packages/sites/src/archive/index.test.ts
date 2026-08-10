import assert from 'node:assert/strict';
import test from 'node:test';
import item from './commands/item.js';
import search from './commands/search.js';
import snapshots from './commands/snapshots.js';
import wayback from './commands/wayback.js';

function context(
  body: unknown,
  requests: Array<{ url: string; query?: { name: string; value: string }[] }>,
) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'archive',
      operation: 'execute' as const,
      command: 'search',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; query?: { name: string; value: string }[] }) => {
      requests.push(request);
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

test('archive commands map metadata, search, CDX, and closest snapshots', async () => {
  const requests: Array<{ url: string; query?: { name: string; value: string }[] }> = [];
  const searchResult = await search.run(
    context(
      {
        response: {
          docs: [
            {
              identifier: 'open-syllabus',
              title: 'Open Syllabus',
              creator: ['Ada', 'Grace'],
              date: '2024-05-06',
              mediatype: 'texts',
              downloads: 12,
            },
          ],
        },
      },
      requests,
    ),
    { query: 'open syllabus', limit: 1 },
  );
  assert.equal((searchResult as Array<{ creator: string }>)[0]?.creator, 'Ada, Grace');

  const itemResult = await item.run(
    context(
      {
        metadata: {
          identifier: 'open-syllabus',
          title: 'Open Syllabus',
          creator: ['Ada'],
          collection: ['education'],
          description: ['A', 'public corpus'],
          date: '2024-05-06',
          mediatype: 'texts',
        },
        files: [{ name: 'data.json' }, { name: 'README' }],
      },
      requests,
    ),
    { identifier: 'open-syllabus' },
  );
  assert.equal((itemResult as Array<{ fileCount: number }>)[0]?.fileCount, 2);

  const snapshotResult = await snapshots.run(
    context(
      [
        ['timestamp', 'original', 'statuscode', 'mimetype'],
        ['20240102123456', 'https://example.com/', '200', 'text/html'],
      ],
      requests,
    ),
    { url: 'example.com', limit: 1 },
  );
  assert.equal(
    (snapshotResult as Array<{ snapshotUrl: string }>)[0]?.snapshotUrl,
    'https://web.archive.org/web/20240102123456/https://example.com/',
  );

  const waybackResult = await wayback.run(
    context(
      {
        url: 'example.com',
        archived_snapshots: {
          closest: {
            available: true,
            timestamp: '20240102123456',
            url: 'https://web.archive.org/web/20240102123456/https://example.com/',
            status: '200',
          },
        },
      },
      requests,
    ),
    { url: 'example.com', timestamp: '2024-01-02' },
  );
  assert.equal(
    (waybackResult as Array<{ requestedTimestamp: string }>)[0]?.requestedTimestamp,
    '20240102',
  );
  assert.ok(requests.some(request => request.url.endsWith('/advancedsearch.php')));
  assert.ok(requests.some(request => request.url.includes('/metadata/')));
  assert.ok(requests.some(request => request.url.includes('/cdx/search/cdx')));
  assert.ok(requests.some(request => request.url.endsWith('/wayback/available')));
});

test('archive validates identifiers and wayback timestamps', async () => {
  await assert.rejects(() => item.run(context({}, []), { identifier: 'bad/id' }), /not valid/);
  await assert.rejects(
    () => wayback.run(context({}, []), { url: 'example.com', timestamp: '2024-1' }),
    /timestamp/,
  );
});
