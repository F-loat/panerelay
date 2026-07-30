import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { format } from 'prettier';
import {
  deriveNextReleaseIdentity,
  PREPARE_RELEASE_METADATA_PATHS,
  prepareNextReleaseMetadata,
} from './prepare-release-lib.mjs';
import { PACKAGE_DEFINITIONS } from './release-lib.mjs';

async function writeJson(root, relativePath, value) {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, await format(JSON.stringify(value), { filepath: path }));
}

async function releaseFixture(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-prepare-release-'));
  const version = overrides.version ?? '0.1.0';
  await writeJson(root, 'package.json', { private: true, version });
  for (const definition of PACKAGE_DEFINITIONS) {
    await writeJson(root, `${definition.directory}/package.json`, {
      name: definition.name,
      version: definition.name === overrides.driftedPackage ? overrides.driftedVersion : version,
    });
  }
  await writeJson(root, 'apps/extension/package.json', { private: true, version });
  await writeJson(root, 'apps/extension/manifest.json', {
    optional_host_permissions: ['http://*/*', 'https://*/*', 'file:///*'],
    version: overrides.extensionVersion ?? '0.1.0.2',
    version_name: version,
  });
  await writeJson(root, 'release.config.json', {
    agentBrowserVerifiedVersions: ['0.33.0'],
    channel: overrides.channel ?? 'stable',
    extensionVersion: overrides.extensionVersion ?? '0.1.0.2',
    version,
  });
  return root;
}

async function sources(root) {
  return new Map(
    await Promise.all(
      PREPARE_RELEASE_METADATA_PATHS.map(async relativePath => [
        relativePath,
        await readFile(join(root, relativePath), 'utf8'),
      ]),
    ),
  );
}

test('derives deterministic major, minor, and patch identities with a minor default', () => {
  assert.deepEqual(deriveNextReleaseIdentity('0.1.0'), {
    baseVersion: '0.1.0',
    branch: 'release/prepare-0.2.0',
    extensionVersion: '0.2.0.0',
    increment: 'minor',
    version: '0.2.0',
  });
  for (const [increment, version] of [
    ['major', '2.0.0'],
    ['minor', '1.10.0'],
    ['patch', '1.9.8'],
  ]) {
    assert.deepEqual(deriveNextReleaseIdentity('1.9.7', increment), {
      baseVersion: '1.9.7',
      branch: `release/prepare-${version}`,
      extensionVersion: `${version}.0`,
      increment,
      version,
    });
  }
});

test('rejects unsupported increments plus malformed and overflowing versions', () => {
  for (const version of ['0.1', '0.1.0-beta.1', '00.1.0', 'next']) {
    assert.throws(() => deriveNextReleaseIdentity(version), /plain stable/);
  }
  assert.throws(() => deriveNextReleaseIdentity('1.2.3', 'build'), /Unsupported/);
  assert.throws(() => deriveNextReleaseIdentity('65535.0.0', 'major'), /component limit/);
  assert.throws(() => deriveNextReleaseIdentity('0.65535.0', 'minor'), /component limit/);
  assert.throws(() => deriveNextReleaseIdentity('0.1.65535', 'patch'), /component limit/);
});

test('updates every release identity field in lockstep', async () => {
  const root = await releaseFixture();
  try {
    const identity = await prepareNextReleaseMetadata({ increment: 'patch', root });
    assert.equal(identity.version, '0.1.1');
    for (const relativePath of [
      'package.json',
      ...PACKAGE_DEFINITIONS.map(definition => `${definition.directory}/package.json`),
      'apps/extension/package.json',
    ]) {
      const manifest = JSON.parse(await readFile(join(root, relativePath), 'utf8'));
      assert.equal(manifest.version, '0.1.1', relativePath);
    }
    const extension = JSON.parse(
      await readFile(join(root, 'apps/extension/manifest.json'), 'utf8'),
    );
    assert.equal(extension.version, '0.1.1.0');
    assert.equal(extension.version_name, '0.1.1');
    const descriptor = JSON.parse(await readFile(join(root, 'release.config.json'), 'utf8'));
    assert.equal(descriptor.channel, 'stable');
    assert.equal(descriptor.version, '0.1.1');
    assert.equal(descriptor.extensionVersion, '0.1.1.0');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('keeps prepared metadata formatted', async () => {
  const root = await releaseFixture();
  try {
    await prepareNextReleaseMetadata({ root });
    for (const relativePath of PREPARE_RELEASE_METADATA_PATHS) {
      const path = join(root, relativePath);
      const source = await readFile(path, 'utf8');
      assert.equal(source, await format(source, { filepath: path }), relativePath);
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('rejects non-lockstep metadata before writing any file', async () => {
  const root = await releaseFixture({
    driftedPackage: '@panerelay/bridge',
    driftedVersion: '0.1.1',
  });
  try {
    const before = await sources(root);
    await assert.rejects(
      prepareNextReleaseMetadata({ root }),
      /packages\/bridge\/package\.json is not lockstep/,
    );
    assert.deepEqual(await sources(root), before);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
