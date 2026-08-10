import assert from 'node:assert/strict';
import test from 'node:test';
import moduleCommand from './commands/module.js';
import versions from './commands/versions.js';

function context(requests: string[]) {
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'goproxy-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    fetch: async (request: { url: string; responseType: 'json' | 'text' }) => {
      requests.push(request.url);
      const body = request.url.endsWith('/@v/list')
        ? 'v1.0.0\nv1.2.0\nv1.1.0\ninvalid'
        : request.url.endsWith('/@latest')
          ? {
              Version: 'v1.2.0',
              Time: '2024-01-02T03:04:05.000Z',
              Origin: {
                VCS: 'git',
                URL: 'https://github.com/acme/mod',
                Hash: 'abc',
                Ref: 'refs/tags/v1.2.0',
              },
            }
          : { Time: '2024-01-02T03:04:05.000Z' };
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        body,
        bodyType: request.responseType,
        url: request.url,
        redirected: false,
        attachedCookieCount: 0,
      };
    },
  };
}

test('GoProxy commands map module metadata and versions', async () => {
  const requests: string[] = [];
  const runContext = context(requests);
  assert.equal(
    (await moduleCommand.run(runContext, { module: 'github.com/acme/mod' }))[0]?.version,
    'v1.2.0',
  );
  const rows = await versions.run(runContext, {
    module: 'github.com/acme/mod',
    limit: 2,
    'with-time': true,
  });
  assert.deepEqual(
    rows.map(row => row.version),
    ['v1.2.0', 'v1.1.0'],
  );
  assert.equal(rows[0]?.publishedAt, '2024-01-02T03:04:05Z');
  assert.equal(requests.length, 4);
});
test('GoProxy validates module paths and limits', async () => {
  await assert.rejects(() => moduleCommand.run(context([]), { module: 'bad module' }), /not valid/);
  await assert.rejects(
    () => versions.run(context([]), { module: 'github.com/acme/mod', limit: 201 }),
    /between 1 and 200/,
  );
});
