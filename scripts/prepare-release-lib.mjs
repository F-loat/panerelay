import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PACKAGE_DEFINITIONS, readJson, validateReleaseIdentity } from './release-lib.mjs';

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CHROME_VERSION_COMPONENT_MAXIMUM = 65535;

export const PREPARE_RELEASE_METADATA_PATHS = [
  'package.json',
  ...PACKAGE_DEFINITIONS.map(definition => `${definition.directory}/package.json`),
  'apps/extension/package.json',
  'apps/extension/manifest.json',
  'release.config.json',
];

const PACKAGE_METADATA_PATHS = [
  'package.json',
  ...PACKAGE_DEFINITIONS.map(definition => `${definition.directory}/package.json`),
  'apps/extension/package.json',
];

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function deriveNextMinorReleaseIdentity(baseVersion) {
  const match = STABLE_VERSION_PATTERN.exec(baseVersion);
  if (!match) throw new Error('Release preparation requires a plain stable X.Y.Z version');
  const major = Number(match[1]);
  const nextMinor = Number(match[2]) + 1;
  if (major > CHROME_VERSION_COMPONENT_MAXIMUM) {
    throw new Error(`Release major version must not exceed ${CHROME_VERSION_COMPONENT_MAXIMUM}`);
  }
  if (nextMinor > CHROME_VERSION_COMPONENT_MAXIMUM) {
    throw new Error(
      `Next release minor version must not exceed ${CHROME_VERSION_COMPONENT_MAXIMUM}`,
    );
  }
  const version = `${major}.${nextMinor}.0`;
  return {
    baseVersion,
    branch: `release/prepare-${version}`,
    extensionVersion: `${major}.${nextMinor}.0.0`,
    version,
  };
}

async function readMetadata(root) {
  return new Map(
    await Promise.all(
      PREPARE_RELEASE_METADATA_PATHS.map(async relativePath => {
        const source = await readFile(join(root, relativePath), 'utf8');
        return [relativePath, { source, value: JSON.parse(source) }];
      }),
    ),
  );
}

function validateLockstep(metadata) {
  const descriptor = metadata.get('release.config.json')?.value;
  if (!descriptor) throw new Error('Release descriptor is missing');
  validateReleaseIdentity(descriptor);
  if ((descriptor.channel ?? 'stable') !== 'stable') {
    throw new Error('Release preparation requires stable repository metadata');
  }
  for (const relativePath of PACKAGE_METADATA_PATHS) {
    const manifest = metadata.get(relativePath)?.value;
    if (manifest?.version !== descriptor.version) {
      throw new Error(`${relativePath} is not lockstep with release.config.json`);
    }
  }
  const extensionManifest = metadata.get('apps/extension/manifest.json')?.value;
  if (
    extensionManifest?.version !== descriptor.extensionVersion ||
    extensionManifest?.version_name !== descriptor.version
  ) {
    throw new Error('Extension manifest is not lockstep with release.config.json');
  }
  return descriptor;
}

export async function prepareNextMinorReleaseMetadata({ root }) {
  const metadata = await readMetadata(root);
  const descriptor = validateLockstep(metadata);
  const identity = deriveNextMinorReleaseIdentity(descriptor.version);

  for (const relativePath of PACKAGE_METADATA_PATHS) {
    metadata.get(relativePath).value.version = identity.version;
  }
  const extensionManifest = metadata.get('apps/extension/manifest.json').value;
  extensionManifest.version = identity.extensionVersion;
  extensionManifest.version_name = identity.version;
  descriptor.channel = 'stable';
  descriptor.version = identity.version;
  descriptor.extensionVersion = identity.extensionVersion;

  try {
    for (const [relativePath, entry] of metadata) {
      await writeFile(join(root, relativePath), serializeJson(entry.value), 'utf8');
    }
    validateLockstep(await readMetadata(root));
  } catch (error) {
    await Promise.all(
      [...metadata].map(([relativePath, entry]) =>
        writeFile(join(root, relativePath), entry.source, 'utf8'),
      ),
    );
    throw error;
  }
  return identity;
}
