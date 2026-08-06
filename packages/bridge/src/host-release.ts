import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isPanerelayReleaseVersion } from '@panerelay/protocol';

declare const __PANERELAY_BRIDGE_RELEASE_VERSION__: string | undefined;

function readPackageReleaseVersion(): unknown {
  const executablePath = process.argv[1];
  if (!executablePath) throw new Error('The Native Host package path is unavailable');
  const packagePath = resolve(dirname(realpathSync(executablePath)), '../package.json');
  return (JSON.parse(readFileSync(packagePath, 'utf8')) as { version?: unknown }).version;
}

const embeddedReleaseVersion =
  typeof __PANERELAY_BRIDGE_RELEASE_VERSION__ === 'string'
    ? __PANERELAY_BRIDGE_RELEASE_VERSION__
    : readPackageReleaseVersion();

if (!isPanerelayReleaseVersion(embeddedReleaseVersion)) {
  throw new Error('The Native Host has an invalid embedded Panerelay release');
}

export const PANERELAY_HOST_RELEASE_VERSION = embeddedReleaseVersion;
