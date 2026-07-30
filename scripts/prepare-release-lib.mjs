import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { PACKAGE_DEFINITIONS, readJson, validateReleaseIdentity } from './release-lib.mjs';

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CHROME_VERSION_COMPONENT_MAXIMUM = 65535;
const RELEASE_INCREMENTS = new Set(['major', 'minor', 'patch']);

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

async function serializeJson(path, value) {
  const config = await resolveConfig(path);
  return format(JSON.stringify(value), {
    ...config,
    filepath: path,
  });
}

export function deriveNextReleaseIdentity(baseVersion, increment = 'minor') {
  const match = STABLE_VERSION_PATTERN.exec(baseVersion);
  if (!match) throw new Error('Release preparation requires a plain stable X.Y.Z version');
  if (!RELEASE_INCREMENTS.has(increment)) {
    throw new Error(`Unsupported release increment: ${increment}`);
  }

  const [major, minor, patch] = match.slice(1).map(Number);
  const components = {
    major: [major + 1, 0, 0],
    minor: [major, minor + 1, 0],
    patch: [major, minor, patch + 1],
  }[increment];
  const overflowingComponent = components.find(
    component => component > CHROME_VERSION_COMPONENT_MAXIMUM,
  );
  if (overflowingComponent !== undefined) {
    throw new Error(
      `Next ${increment} release version must not exceed Chrome's ${CHROME_VERSION_COMPONENT_MAXIMUM} component limit`,
    );
  }

  const version = components.join('.');
  return {
    baseVersion,
    branch: `release/prepare-${version}`,
    extensionVersion: `${version}.0`,
    increment,
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

export async function prepareNextReleaseMetadata({ increment = 'minor', root }) {
  const metadata = await readMetadata(root);
  const descriptor = validateLockstep(metadata);
  const identity = deriveNextReleaseIdentity(descriptor.version, increment);

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
      const path = join(root, relativePath);
      await writeFile(path, await serializeJson(path, entry.value), 'utf8');
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
