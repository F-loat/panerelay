import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  classifyPublishedIntegrity,
  loadCandidatePublication,
  publicationTag,
  publishCandidate,
} from './publish-release-lib.mjs';
import { PACKAGE_DEFINITIONS } from './release-lib.mjs';

function hash(value, algorithm, encoding) {
  return createHash(algorithm).update(value).digest(encoding);
}

async function candidateFixture(channel = 'beta') {
  const candidateDirectory = await mkdtemp(join(tmpdir(), 'panerelay-publish-candidate-'));
  const version = channel === 'stable' ? '0.1.0' : '0.1.0-beta.9';
  const manifests = new Map();
  const artifacts = [];
  for (const [index, definition] of PACKAGE_DEFINITIONS.entries()) {
    const file = `package-${index}.tgz`;
    const content = Buffer.from(`${definition.name}@${version}`);
    await writeFile(join(candidateDirectory, file), content);
    manifests.set(join(candidateDirectory, file), { name: definition.name, version });
    artifacts.push({
      bytes: content.length,
      file,
      sha256: hash(content, 'sha256', 'hex'),
      type: 'npm',
    });
  }
  artifacts.reverse();
  await writeFile(
    join(candidateDirectory, 'inventory.json'),
    `${JSON.stringify({ artifacts, channel, version }, null, 2)}\n`,
  );
  return {
    candidateDirectory,
    manifests,
    readManifest: async path => manifests.get(path),
    version,
  };
}

test('maps channels to npm distribution tags and classifies integrity', () => {
  assert.equal(publicationTag('stable'), 'latest');
  assert.equal(publicationTag('beta'), 'beta');
  assert.throws(() => publicationTag('nightly'), /Unsupported release channel/);
  assert.equal(classifyPublishedIntegrity('sha512-local', null), 'missing');
  assert.equal(classifyPublishedIntegrity('sha512-local', 'sha512-local'), 'published-identical');
  assert.equal(classifyPublishedIntegrity('sha512-local', 'sha512-other'), 'conflict');
});

test('builds a dependency-ordered offline publication plan', async () => {
  const fixture = await candidateFixture();
  try {
    const lookupOrder = [];
    const publication = await loadCandidatePublication({
      candidateDirectory: fixture.candidateDirectory,
      readManifest: fixture.readManifest,
      registryLookup: async (name, version) => {
        lookupOrder.push(`${name}@${version}`);
        return null;
      },
    });
    assert.equal(publication.tag, 'beta');
    assert.deepEqual(
      publication.packages.map(candidate => candidate.name),
      PACKAGE_DEFINITIONS.map(definition => definition.name),
    );
    assert.deepEqual(
      lookupOrder,
      PACKAGE_DEFINITIONS.map(definition => `${definition.name}@${fixture.version}`),
    );
    assert.ok(
      publication.packages.every(
        candidate => candidate.state === 'missing' && candidate.integrity.startsWith('sha512-'),
      ),
    );
  } finally {
    await rm(fixture.candidateDirectory, { force: true, recursive: true });
  }
});

test('skips identical packages and publishes only missing tarballs in order', async () => {
  const fixture = await candidateFixture('stable');
  try {
    const published = [];
    const publication = await publishCandidate({
      candidateDirectory: fixture.candidateDirectory,
      publishTarball: async candidate => published.push(candidate),
      readManifest: fixture.readManifest,
      registryLookup: async name => {
        if (name !== PACKAGE_DEFINITIONS[0].name) return null;
        const path = join(fixture.candidateDirectory, 'package-0.tgz');
        return `sha512-${hash(await readFile(path), 'sha512', 'base64')}`;
      },
    });
    assert.equal(publication.packages[0].state, 'published-identical');
    assert.deepEqual(
      published.map(candidate => candidate.name),
      PACKAGE_DEFINITIONS.slice(1).map(definition => definition.name),
    );
    assert.ok(published.every(candidate => candidate.tag === 'latest'));
  } finally {
    await rm(fixture.candidateDirectory, { force: true, recursive: true });
  }
});

test('fails preflight before publishing when registry integrity conflicts', async () => {
  const fixture = await candidateFixture();
  try {
    let publicationStarted = false;
    await assert.rejects(
      publishCandidate({
        candidateDirectory: fixture.candidateDirectory,
        publishTarball: async () => {
          publicationStarted = true;
        },
        readManifest: fixture.readManifest,
        registryLookup: async name =>
          name === PACKAGE_DEFINITIONS[2].name ? 'sha512-conflict' : null,
      }),
      /already exists with different integrity/,
    );
    assert.equal(publicationStarted, false);
  } finally {
    await rm(fixture.candidateDirectory, { force: true, recursive: true });
  }
});
