import { isPanerelayChromiumBuildVersion, isPanerelayReleaseVersion } from '@panerelay/protocol';

export interface ExtensionManifestIdentity {
  releaseVersion: string;
  buildVersion: string;
}

export function parseExtensionManifestIdentity(manifest: {
  version?: unknown;
  version_name?: unknown;
}): ExtensionManifestIdentity {
  if (!isPanerelayReleaseVersion(manifest.version_name)) {
    throw new Error('The Panerelay Extension manifest requires a valid semantic version_name');
  }
  if (!isPanerelayChromiumBuildVersion(manifest.version)) {
    throw new Error('The Panerelay Extension manifest requires a four-part Chromium version');
  }
  return {
    releaseVersion: manifest.version_name,
    buildVersion: manifest.version,
  };
}

export function extensionManifestIdentity(): ExtensionManifestIdentity {
  return parseExtensionManifestIdentity(chrome.runtime.getManifest());
}
