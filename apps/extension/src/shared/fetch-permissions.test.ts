import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FETCH_AUTHORIZED_DOMAINS_KEY,
  FETCH_AUTHORIZE_ALL_DOMAINS_KEY,
  assertFetchUrlAuthorized,
  doesFetchDomainMatch,
  fetchDomainForUrl,
  fetchPermissionPatterns,
  grantFetchDomain,
  isFetchDomainAuthorized,
  readFetchAuthorization,
  revokeFetchDomain,
  setFetchAllDomains,
  type FetchPermissionStorage,
} from './fetch-permissions.js';

function memoryStorage(seed: Record<string, unknown> = {}): FetchPermissionStorage & {
  value: Record<string, unknown>;
} {
  const value = { ...seed };
  return {
    value,
    async get(keys) {
      return Object.fromEntries(keys.map(key => [key, value[key]]));
    },
    async set(items) {
      Object.assign(value, items);
    },
  };
}

test('reduces fetch URLs to scheme-independent hostnames', () => {
  assert.equal(fetchDomainForUrl('https://api.example.com/path?q=1'), 'api.example.com');
  assert.equal(fetchDomainForUrl('http://localhost:4173/path'), 'localhost');
  assert.equal(fetchDomainForUrl('https://user:secret@example.com'), null);
  assert.equal(fetchDomainForUrl('file:///tmp/value'), null);
});

test('persists sorted exact and wildcard domains independently from all-domain access', async () => {
  const storage = memoryStorage({
    [FETCH_AUTHORIZED_DOMAINS_KEY]: ['*.b.example', 'bad domain', 'a.example'],
    [FETCH_AUTHORIZE_ALL_DOMAINS_KEY]: false,
  });
  assert.deepEqual(await readFetchAuthorization(storage), {
    allDomains: false,
    domains: ['*.b.example', 'a.example'],
  });
  await grantFetchDomain('c.example', storage);
  await setFetchAllDomains(true, storage);
  assert.equal(
    isFetchDomainAuthorized('unlisted.example', await readFetchAuthorization(storage)),
    true,
  );
  await setFetchAllDomains(false, storage);
  await revokeFetchDomain('a.example', storage);
  assert.deepEqual(await readFetchAuthorization(storage), {
    allDomains: false,
    domains: ['*.b.example', 'c.example'],
  });
});

test('drops non-canonical stored values instead of silently turning them into grants', async () => {
  const storage = memoryStorage({
    [FETCH_AUTHORIZED_DOMAINS_KEY]: [
      'https://unexpected.example/path',
      'UPPER.example',
      'valid.example',
    ],
  });
  assert.deepEqual(await readFetchAuthorization(storage), {
    allDomains: false,
    domains: ['valid.example'],
  });
});

test('wildcards include the root and subdomains without matching suffix lookalikes', () => {
  assert.equal(doesFetchDomainMatch('*.baidu.com', 'baidu.com'), true);
  assert.equal(doesFetchDomainMatch('*.baidu.com', 'map.baidu.com'), true);
  assert.equal(doesFetchDomainMatch('*.baidu.com', 'notbaidu.com'), false);
});

test('expands scheme-independent domains to declared Chrome Host Permission patterns', () => {
  assert.deepEqual(fetchPermissionPatterns('domain', '*.baidu.com'), [
    'http://*.baidu.com/*',
    'https://*.baidu.com/*',
  ]);
  assert.deepEqual(fetchPermissionPatterns('all-domains'), ['http://*/*', 'https://*/*']);
});

test('rejects before fetch with an exact Agent authorization command', () => {
  assert.throws(
    () =>
      assertFetchUrlAuthorized('https://api.example.com/items?private=1', {
        allDomains: false,
        domains: [],
      }),
    error =>
      error instanceof Error &&
      error.message ===
        'Browser fetch access to domain "api.example.com" is not authorized. Ask the user to approve it, then run: panerelay fetch --authorize api.example.com',
  );
});
