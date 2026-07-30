import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  deriveNextMinorReleaseIdentity,
  PREPARE_RELEASE_METADATA_PATHS,
  prepareNextMinorReleaseMetadata,
} from './prepare-release-lib.mjs';
import { PACKAGE_DEFINITIONS } from './release-lib.mjs';

async function writeJson(root, relativePath, value) {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
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
    version: overrides.extensionVersion ?? '0.1.0.2',
    version_name: version,
  });
  await writeJson(root, 'release.config.json', {
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

test('derives a deterministic next-minor semantic and Chrome identity', () => {
  assert.deepEqual(deriveNextMinorReleaseIdentity('0.1.0'), {
    baseVersion: '0.1.0',
    branch: 'release/prepare-0.2.0',
    extensionVersion: '0.2.0.0',
    version: '0.2.0',
  });
  assert.deepEqual(deriveNextMinorReleaseIdentity('1.9.7'), {
    baseVersion: '1.9.7',
    branch: 'release/prepare-1.10.0',
    extensionVersion: '1.10.0.0',
    version: '1.10.0',
  });
});

test('rejects malformed and overflowing base versions', () => {
  for (const version of ['0.1', '0.1.0-beta.1', '00.1.0', 'next']) {
    assert.throws(() => deriveNextMinorReleaseIdentity(version), /plain stable/);
  }
  assert.throws(() => deriveNextMinorReleaseIdentity('0.65535.0'), /minor version/);
  assert.throws(() => deriveNextMinorReleaseIdentity('65536.0.0'), /major version/);
});

test('updates every release identity field in lockstep', async () => {
  const root = await releaseFixture();
  try {
    const identity = await prepareNextMinorReleaseMetadata({ root });
    assert.equal(identity.version, '0.2.0');
    for (const relativePath of [
      'package.json',
      ...PACKAGE_DEFINITIONS.map(definition => `${definition.directory}/package.json`),
      'apps/extension/package.json',
    ]) {
      const manifest = JSON.parse(await readFile(join(root, relativePath), 'utf8'));
      assert.equal(manifest.version, '0.2.0', relativePath);
    }
    const extension = JSON.parse(
      await readFile(join(root, 'apps/extension/manifest.json'), 'utf8'),
    );
    assert.equal(extension.version, '0.2.0.0');
    assert.equal(extension.version_name, '0.2.0');
    const descriptor = JSON.parse(await readFile(join(root, 'release.config.json'), 'utf8'));
    assert.equal(descriptor.channel, 'stable');
    assert.equal(descriptor.version, '0.2.0');
    assert.equal(descriptor.extensionVersion, '0.2.0.0');
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
      prepareNextMinorReleaseMetadata({ root }),
      /packages\/bridge\/package\.json is not lockstep/,
    );
    assert.deepEqual(await sources(root), before);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
