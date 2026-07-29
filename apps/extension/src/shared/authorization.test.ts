import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_WEB_ORIGIN_PATTERNS,
  isOriginEligible,
  originAuthorizationForUrl,
} from './authorization.js';

test('derives exact origin permission patterns without widening ports', () => {
  assert.deepEqual(originAuthorizationForUrl('http://localhost:4173/form?q=1'), {
    origin: 'http://localhost:4173',
    permissionPattern: 'http://localhost:4173/*',
  });
  assert.deepEqual(originAuthorizationForUrl('https://example.com/path'), {
    origin: 'https://example.com',
    permissionPattern: 'https://example.com/*',
  });
});

test('rejects browser-internal pages from origin authorization', () => {
  assert.equal(originAuthorizationForUrl('chrome://extensions'), null);
  assert.equal(originAuthorizationForUrl('about:blank'), null);
  assert.equal(originAuthorizationForUrl('https://chrome.google.com/webstore/devconsole'), null);
  assert.equal(originAuthorizationForUrl('https://chromewebstore.google.com/detail/example'), null);
  assert.equal(originAuthorizationForUrl('not a url'), null);
});

test('keeps single-tab origins exact and all-tabs web access explicit', () => {
  assert.equal(
    isOriginEligible('https://example.com/page', 'single-tab', ['https://example.com/*']),
    true,
  );
  assert.equal(
    isOriginEligible('https://other.example/page', 'single-tab', ['https://example.com/*']),
    false,
  );
  assert.equal(
    isOriginEligible('https://other.example/page', 'all-tabs', ALL_WEB_ORIGIN_PATTERNS),
    true,
  );
  assert.equal(
    isOriginEligible('file:///tmp/example.html', 'all-tabs', ALL_WEB_ORIGIN_PATTERNS),
    false,
  );
});
