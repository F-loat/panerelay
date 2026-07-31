import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  PACKAGE_DEFINITIONS,
  createReleaseCandidate,
  readJson,
  run,
  validateReleaseIdentity,
} from './release-lib.mjs';

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CHROME_VERSION_COMPONENT_MAXIMUM = 65535;
const VERSION_METADATA_PATHS = [
  'package.json',
  ...PACKAGE_DEFINITIONS.map(definition => `${definition.directory}/package.json`),
  'apps/extension/package.json',
  'apps/extension/manifest.json',
  'apps/extension/manifest.firefox.json',
  'release.config.json',
];

function positiveChromeComponent(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > CHROME_VERSION_COMPONENT_MAXIMUM) {
    throw new Error(
      `${label} must be an integer between 1 and ${CHROME_VERSION_COMPONENT_MAXIMUM}`,
    );
  }
  return number;
}

export function deriveBetaIdentity(stableVersion, runNumber, runAttempt) {
  const stableMatch = STABLE_VERSION_PATTERN.exec(stableVersion);
  if (!stableMatch) {
    throw new Error('Beta releases require a plain stable X.Y.Z repository version');
  }
  const normalizedRunNumber = positiveChromeComponent(runNumber, 'Beta run number');
  const normalizedRunAttempt = positiveChromeComponent(runAttempt, 'Beta run attempt');
  return {
    channel: 'beta',
    extensionVersion: `${stableMatch[1]}.${stableMatch[2]}.${normalizedRunNumber}.${normalizedRunAttempt}`,
    version: `${stableVersion}-beta.${normalizedRunNumber}`,
  };
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function snapshotVersionMetadata(root) {
  return new Map(
    await Promise.all(
      VERSION_METADATA_PATHS.map(async relativePath => [
        relativePath,
        await readFile(join(root, relativePath), 'utf8'),
      ]),
    ),
  );
}

async function restoreVersionMetadata(root, snapshots) {
  await Promise.all(
    [...snapshots].map(([relativePath, source]) =>
      writeFile(join(root, relativePath), source, 'utf8'),
    ),
  );
}

async function applyBetaIdentity(root, identity) {
  const packagePaths = [
    'package.json',
    ...PACKAGE_DEFINITIONS.map(definition => `${definition.directory}/package.json`),
    'apps/extension/package.json',
  ];
  for (const relativePath of packagePaths) {
    const manifest = await readJson(join(root, relativePath));
    manifest.version = identity.version;
    await writeFile(join(root, relativePath), serializeJson(manifest), 'utf8');
  }

  for (const relativePath of [
    'apps/extension/manifest.json',
    'apps/extension/manifest.firefox.json',
  ]) {
    const extensionManifestPath = join(root, relativePath);
    const extensionManifest = await readJson(extensionManifestPath);
    extensionManifest.version = identity.extensionVersion;
    extensionManifest.version_name = identity.version;
    await writeFile(extensionManifestPath, serializeJson(extensionManifest), 'utf8');
  }

  const descriptorPath = join(root, 'release.config.json');
  const descriptor = await readJson(descriptorPath);
  descriptor.channel = identity.channel;
  descriptor.version = identity.version;
  descriptor.extensionVersion = identity.extensionVersion;
  await writeFile(descriptorPath, serializeJson(descriptor), 'utf8');
}

async function gitStatus(root) {
  return (await run('git', ['status', '--porcelain'], { cwd: root })).stdout;
}

export async function prepareReleaseChannel({
  channel,
  createCandidate = createReleaseCandidate,
  outputDirectory,
  readStatus = gitStatus,
  root,
  runAttempt,
  runNumber,
}) {
  if (channel !== 'stable' && channel !== 'beta') {
    throw new Error(`Unsupported release channel: ${channel}`);
  }
  const statusBefore = await readStatus(root);
  if (statusBefore.length > 0) {
    throw new Error('Release channel preparation requires a clean source tree');
  }

  const descriptor = await readJson(join(root, 'release.config.json'));
  const identity =
    channel === 'beta'
      ? deriveBetaIdentity(descriptor.version, runNumber, runAttempt)
      : {
          channel: descriptor.channel ?? 'stable',
          extensionVersion: descriptor.extensionVersion,
          version: descriptor.version,
        };
  if (channel === 'stable' && identity.channel !== 'stable') {
    throw new Error('Stable publication requires stable release metadata');
  }
  validateReleaseIdentity(identity);

  const candidateDirectory =
    outputDirectory ?? join(root, '.artifacts', `panerelay-${identity.version}`);
  const snapshots = channel === 'beta' ? await snapshotVersionMetadata(root) : null;
  let inventory;
  try {
    if (channel === 'beta') await applyBetaIdentity(root, identity);
    await rm(candidateDirectory, { force: true, recursive: true });
    inventory = await createCandidate({
      outputDirectory: candidateDirectory,
      root,
      sourceDirty: false,
    });
  } finally {
    if (snapshots) await restoreVersionMetadata(root, snapshots);
  }

  const statusAfter = await readStatus(root);
  if (statusAfter !== statusBefore) {
    throw new Error('Release channel preparation did not restore the source tree');
  }
  const chromiumExtensionArtifact = inventory.artifacts.find(
    artifact => artifact.type === 'extension-chromium' || artifact.type === 'extension',
  );
  const firefoxExtensionArtifact = inventory.artifacts.find(
    artifact => artifact.type === 'extension-firefox',
  );
  if (!chromiumExtensionArtifact || !firefoxExtensionArtifact) {
    throw new Error('Release candidate does not contain both Extension archives');
  }
  return {
    artifactDirectory: relative(root, candidateDirectory),
    channel,
    extensionArchive: relative(root, join(candidateDirectory, chromiumExtensionArtifact.file)),
    firefoxExtensionArchive: relative(
      root,
      join(candidateDirectory, firefoxExtensionArtifact.file),
    ),
    inventory,
    npmTag: channel === 'stable' ? 'latest' : 'beta',
    releaseTag: channel === 'stable' ? `v${identity.version}` : '',
    version: identity.version,
  };
}
