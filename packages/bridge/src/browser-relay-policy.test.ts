import assert from 'node:assert/strict';
import test from 'node:test';
import type { CdpTargetInfo } from '@panerelay/protocol';
import { targetCommandPolicyError } from './browser-relay-policy.js';

const target: CdpTargetInfo = {
  targetId: 'target-1',
  type: 'page',
  title: 'Fixture',
  url: 'https://example.com/path',
  attached: false,
  active: true,
};

test('rejects browser ownership and profile-wide cookie commands', () => {
  assert.match(
    targetCommandPolicyError(target, 'Browser.close', {}) ?? '',
    /browser-process ownership/,
  );
  assert.match(
    targetCommandPolicyError(target, 'Storage.getCookies', {}) ?? '',
    /entire daily Chrome profile/,
  );
});

test('bounds cookie and storage operations to the selected target origin', () => {
  assert.equal(
    targetCommandPolicyError(target, 'Network.getCookies', {
      urls: ['https://example.com/account'],
    }),
    null,
  );
  assert.match(
    targetCommandPolicyError(target, 'Network.getCookies', {
      urls: ['https://other.example/account'],
    }) ?? '',
    /selected Panerelay target origin/,
  );
  assert.equal(
    targetCommandPolicyError(target, 'Network.setCookie', {
      domain: '.example.com',
      name: 'fixture',
      value: '1',
    }),
    null,
  );
  assert.match(
    targetCommandPolicyError(target, 'Network.setCookies', {
      cookies: [{ domain: 'other.example', name: 'fixture', value: '1' }],
    }) ?? '',
    /selected Panerelay target host/,
  );
  assert.equal(
    targetCommandPolicyError(target, 'Storage.clearDataForOrigin', {
      origin: 'https://example.com',
    }),
    null,
  );
  assert.match(
    targetCommandPolicyError(target, 'Storage.clearDataForOrigin', {
      origin: 'https://other.example',
    }) ?? '',
    /selected Panerelay target origin/,
  );
});

test('leaves page commands and non-web target metadata unchanged', () => {
  assert.equal(targetCommandPolicyError(target, 'Runtime.evaluate', {}), null);
  assert.equal(
    targetCommandPolicyError({ ...target, url: 'chrome://settings' }, 'Network.getCookies', {
      urls: ['https://other.example'],
    }),
    null,
  );
});
