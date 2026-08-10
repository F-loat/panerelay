import assert from 'node:assert/strict';
import test from 'node:test';
import formula from './commands/formula.js';
import cask from './commands/cask.js';
import popular from './commands/popular.js';

function context(body: unknown, status = 200) {
  const requests: Array<{ url: string }> = [];
  return {
    artifact: () => {
      throw new Error('No artifact fixture');
    },
    requests,
    invocation: {
      protocol: 'panerelay.fetch-adapter.v3' as const,
      requestId: 'homebrew-test',
      operation: 'execute' as const,
      command: 'test',
      args: {},
      fetch: {
        endpoint: 'http://127.0.0.1/fetch',
        token: 'test',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    },
    fetch: async (request: { url: string }) => {
      requests.push(request);
      return {
        status,
        statusText: status === 200 ? 'OK' : 'Not Found',
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

test('Homebrew maps formula, cask, and analytics rows', async () => {
  const formulaContext = context({
    name: 'wget',
    tap: 'homebrew/core',
    versions: { stable: '1.2.3' },
    license: 'ISC',
    desc: 'Network utility',
    homepage: 'https://example.test',
    dependencies: ['openssl'],
    urls: { stable: { url: 'https://source.test/wget.tar.gz' } },
  });
  assert.deepEqual(await formula.run(formulaContext, { name: 'wget' }), [
    {
      formula: 'wget',
      tap: 'homebrew/core',
      version: '1.2.3',
      license: 'ISC',
      description: 'Network utility',
      homepage: 'https://example.test',
      dependencies: 'openssl',
      deprecated: false,
      disabled: false,
      source: 'https://source.test/wget.tar.gz',
      url: 'https://formulae.brew.sh/formula/wget',
    },
  ]);
  const caskContext = context({
    token: 'firefox',
    tap: 'homebrew/cask',
    name: ['Firefox'],
    version: '1.0',
    desc: 'Browser',
    homepage: 'https://mozilla.org',
    url: 'https://download.test/firefox.dmg',
  });
  assert.equal((await cask.run(caskContext, { token: 'firefox' }))[0]?.cask, 'firefox');
  const popularContext = context({
    items: [{ number: 1, formula: 'wget', count: '1,234', percent: '12.5' }],
  });
  assert.deepEqual(
    await popular.run(popularContext, { type: 'formula', window: '30d', limit: 5 }),
    [
      {
        rank: 1,
        token: 'wget',
        type: 'formula',
        installs: 1234,
        percent: 12.5,
        window: '30d',
        url: 'https://formulae.brew.sh/formula/wget',
      },
    ],
  );
});

test('Homebrew validates tokens and limits and maps missing resources', async () => {
  await assert.rejects(() => formula.run(context({}), { name: 'bad token' }), /valid token/);
  await assert.rejects(
    () => popular.run(context({}), { type: 'formula', window: '30d', limit: 501 }),
    /limit/,
  );
  await assert.rejects(() => formula.run(context({}, 404), { name: 'wget' }), /not found/);
});
