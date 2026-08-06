import assert from 'node:assert/strict';
import test from 'node:test';
import {
  comparePanerelayReleaseVersions,
  isPanerelayChromiumBuildVersion,
  isPanerelayReleaseVersion,
  parsePanerelayReleaseVersion,
} from './release-version.js';

test('parses supported stable and beta Panerelay releases', () => {
  assert.deepEqual(parsePanerelayReleaseVersion('0.7.0'), {
    raw: '0.7.0',
    major: 0,
    minor: 7,
    patch: 0,
    channel: 'stable',
  });
  assert.deepEqual(parsePanerelayReleaseVersion('0.8.0-beta.42'), {
    raw: '0.8.0-beta.42',
    major: 0,
    minor: 8,
    patch: 0,
    channel: 'beta',
    beta: 42,
  });
});

test('accepts only bounded four-part Chromium build versions', () => {
  assert.equal(isPanerelayChromiumBuildVersion('0.7.0.0'), true);
  assert.equal(isPanerelayChromiumBuildVersion('65535.65535.65535.65535'), true);
  for (const value of [
    '0.7.0',
    '0.7.0.0.1',
    '00.7.0.0',
    '0.7.0-beta.1',
    '0.7.0.65536',
    '0.7.0.0 && calc',
  ]) {
    assert.equal(isPanerelayChromiumBuildVersion(value), false, value);
  }
});

test('orders releases by SemVer stable and beta precedence', () => {
  assert.equal(comparePanerelayReleaseVersions('0.7.0', '0.7.0'), 0);
  assert.equal(comparePanerelayReleaseVersions('0.7.0-beta.2', '0.7.0-beta.12'), -1);
  assert.equal(comparePanerelayReleaseVersions('0.7.0-beta.12', '0.7.0'), -1);
  assert.equal(comparePanerelayReleaseVersions('0.7.0', '0.7.0-beta.12'), 1);
  assert.equal(comparePanerelayReleaseVersions('0.8.0-beta.1', '0.7.9'), 1);
  assert.equal(comparePanerelayReleaseVersions('1.0.0', '0.99.99'), 1);
});

test('rejects Chrome builds, tags, ranges, paths, unsupported prereleases, and unsafe numbers', () => {
  for (const value of [
    '0.7.0.0',
    'latest',
    'beta',
    '^0.7.0',
    '@panerelay/setup@0.7.0',
    '../0.7.0',
    '0.7.0;whoami',
    '01.7.0',
    '0.07.0',
    '0.7.00',
    '0.7.0-alpha.1',
    '0.7.0-beta.01',
    '0.7.0+build.1',
    '65536.0.0',
    `0.7.0-beta.${'9'.repeat(65)}`,
    '',
    null,
  ]) {
    assert.equal(isPanerelayReleaseVersion(value), false, String(value));
  }
  assert.throws(
    () => comparePanerelayReleaseVersions('0.7.0', 'latest'),
    /requires valid stable or beta/,
  );
});
