import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PACKAGE_DEFINITIONS, readJson, run } from './release-lib.mjs';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function digest(path, algorithm, encoding) {
  return createHash(algorithm)
    .update(await readFile(path))
    .digest(encoding);
}

export function publicationTag(channel) {
  if (channel === 'stable') return 'latest';
  if (channel === 'beta') return 'beta';
  throw new Error(`Unsupported release channel: ${channel}`);
}

export function classifyPublishedIntegrity(localIntegrity, publishedIntegrity) {
  if (publishedIntegrity === null) return 'missing';
  if (publishedIntegrity === localIntegrity) return 'published-identical';
  return 'conflict';
}

async function readPackedManifest(path) {
  const source = (await run('tar', ['-xOf', path, 'package/package.json'])).stdout;
  return JSON.parse(source);
}

async function lookupNpmIntegrity(name, version) {
  try {
    const result = await run('npm', ['view', `${name}@${version}`, 'dist.integrity', '--json']);
    const source = result.stdout.trim();
    if (!source) return null;
    const value = JSON.parse(source);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch (error) {
    if (/\bE404\b|\b404\b/.test(error instanceof Error ? error.message : String(error))) {
      return null;
    }
    throw error;
  }
}

async function publishTarball({ path, tag }) {
  await run('npm', ['publish', path, '--access', 'public', '--tag', tag], { echo: true });
}

export async function loadCandidatePublication({
  candidateDirectory,
  readManifest = readPackedManifest,
  registryLookup = lookupNpmIntegrity,
}) {
  const inventory = await readJson(join(candidateDirectory, 'inventory.json'));
  const tag = publicationTag(inventory.channel);
  invariant(typeof inventory.version === 'string', 'Candidate inventory has no version');
  const npmArtifacts = inventory.artifacts?.filter(artifact => artifact.type === 'npm') ?? [];
  invariant(
    npmArtifacts.length === PACKAGE_DEFINITIONS.length,
    'Candidate inventory does not contain the complete npm package set',
  );

  const packages = [];
  for (const artifact of npmArtifacts) {
    invariant(
      artifact.file === basename(artifact.file),
      `Candidate npm artifact has an unsafe path: ${artifact.file}`,
    );
    const path = join(candidateDirectory, artifact.file);
    const sha256 = await digest(path, 'sha256', 'hex');
    invariant(sha256 === artifact.sha256, `${artifact.file} does not match candidate SHA-256`);
    const manifest = await readManifest(path);
    invariant(
      manifest.version === inventory.version,
      `${manifest.name ?? artifact.file} does not match candidate version`,
    );
    packages.push({
      artifact,
      integrity: `sha512-${await digest(path, 'sha512', 'base64')}`,
      manifest,
      path,
    });
  }

  const byName = new Map(packages.map(candidate => [candidate.manifest.name, candidate]));
  invariant(
    byName.size === PACKAGE_DEFINITIONS.length,
    'Candidate tarballs contain duplicate or missing package names',
  );
  const orderedPackages = [];
  for (const definition of PACKAGE_DEFINITIONS) {
    const candidate = byName.get(definition.name);
    invariant(candidate, `Candidate is missing ${definition.name}`);
    const publishedIntegrity = await registryLookup(definition.name, inventory.version);
    const state = classifyPublishedIntegrity(candidate.integrity, publishedIntegrity);
    invariant(
      state !== 'conflict',
      `${definition.name}@${inventory.version} already exists with different integrity`,
    );
    orderedPackages.push({
      ...candidate,
      name: definition.name,
      publishedIntegrity,
      state,
    });
  }
  return { inventory, packages: orderedPackages, tag };
}

export async function publishCandidate(options) {
  const publication = await loadCandidatePublication(options);
  const publish = options.publishTarball ?? publishTarball;
  for (const candidate of publication.packages) {
    if (candidate.state === 'published-identical') {
      console.log(`${candidate.name}@${publication.inventory.version} already matches candidate.`);
      continue;
    }
    await publish({
      name: candidate.name,
      path: candidate.path,
      tag: publication.tag,
      version: publication.inventory.version,
    });
  }
  return publication;
}
