import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { deriveBetaIdentity, prepareReleaseChannel } from './release-channel-lib.mjs';
import { PACKAGE_DEFINITIONS } from './release-lib.mjs';

const VERSION_PATHS = [
  'package.json',
  ...PACKAGE_DEFINITIONS.map(definition => `${definition.directory}/package.json`),
  'apps/extension/package.json',
  'apps/extension/manifest.json',
  'release.config.json',
];

async function writeJson(root, relativePath, value) {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function releaseFixture() {
  const root = await mkdtemp(join(tmpdir(), 'panerelay-release-channel-'));
  await writeJson(root, 'package.json', { name: 'panerelay', private: true, version: '0.1.0' });
  for (const definition of PACKAGE_DEFINITIONS) {
    await writeJson(root, `${definition.directory}/package.json`, {
      name: definition.name,
      version: '0.1.0',
    });
  }
  await writeJson(root, 'apps/extension/package.json', {
    name: '@panerelay/extension',
    private: true,
    version: '0.1.0',
  });
  await writeJson(root, 'apps/extension/manifest.json', {
    manifest_version: 3,
    version: '0.1.0.2',
    version_name: '0.1.0',
  });
  await writeJson(root, 'release.config.json', {
    channel: 'stable',
    extensionVersion: '0.1.0.2',
    version: '0.1.0',
  });
  return root;
}

async function versionSources(root) {
  return new Map(
    await Promise.all(
      VERSION_PATHS.map(async relativePath => [
        relativePath,
        await readFile(join(root, relativePath), 'utf8'),
      ]),
    ),
  );
}

test('derives unique beta package and Chrome identities', () => {
  assert.deepEqual(deriveBetaIdentity('0.1.0', '42', '3'), {
    channel: 'beta',
    extensionVersion: '0.1.42.3',
    version: '0.1.0-beta.42.3',
  });
  assert.throws(() => deriveBetaIdentity('0.1.0-beta.1', 1, 1), /plain stable/);
  assert.throws(() => deriveBetaIdentity('0.1.0', 0, 1), /run number/);
  assert.throws(() => deriveBetaIdentity('0.1.0', 1, 65536), /run attempt/);
});

test('temporarily applies beta metadata and restores every source file', async () => {
  const root = await releaseFixture();
  try {
    const before = await versionSources(root);
    let observedDescriptor;
    const result = await prepareReleaseChannel({
      channel: 'beta',
      createCandidate: async ({ outputDirectory, root: candidateRoot, sourceDirty }) => {
        observedDescriptor = JSON.parse(
          await readFile(join(candidateRoot, 'release.config.json'), 'utf8'),
        );
        assert.equal(sourceDirty, false);
        return {
          artifacts: [
            {
              file: `panerelay-extension-${observedDescriptor.version}.zip`,
              type: 'extension',
            },
          ],
        };
      },
      readStatus: async () => '',
      root,
      runAttempt: 2,
      runNumber: 17,
    });

    assert.deepEqual(observedDescriptor, {
      channel: 'beta',
      extensionVersion: '0.1.17.2',
      version: '0.1.0-beta.17.2',
    });
    assert.equal(result.version, '0.1.0-beta.17.2');
    assert.equal(result.npmTag, 'beta');
    assert.equal(result.releaseTag, '');
    assert.deepEqual(await versionSources(root), before);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('restores beta metadata when candidate creation fails', async () => {
  const root = await releaseFixture();
  try {
    const before = await versionSources(root);
    await assert.rejects(
      prepareReleaseChannel({
        channel: 'beta',
        createCandidate: async () => {
          throw new Error('candidate failed');
        },
        readStatus: async () => '',
        root,
        runAttempt: 1,
        runNumber: 8,
      }),
      /candidate failed/,
    );
    assert.deepEqual(await versionSources(root), before);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('rejects dirty source before preparing either channel', async () => {
  const root = await releaseFixture();
  try {
    await assert.rejects(
      prepareReleaseChannel({
        channel: 'stable',
        createCandidate: async () => {
          throw new Error('must not run');
        },
        readStatus: async () => ' M package.json\n',
        root,
      }),
      /requires a clean source tree/,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
