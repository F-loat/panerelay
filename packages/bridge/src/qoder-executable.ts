import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  executableCandidatePaths,
  executableNames,
  isExecutableFile,
  probeExecutableVersion,
  type CommandRunner,
} from './platform.js';

export interface QoderExecutableResolution {
  error?: string;
  executable?: string;
  version?: string;
}

export interface QoderExecutableOptions {
  configuredPath?: string;
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  processExecPath?: string;
  readdirVersioned?: (directory: string) => Promise<string[]>;
  runner?: CommandRunner;
}

function platformPath(platform: NodeJS.Platform): typeof path.posix {
  return platform === 'win32' ? path.win32 : path.posix;
}

async function versionedQoderCandidates(
  directory: string,
  read: (directory: string) => Promise<string[]>,
  pathApi: typeof path.posix,
): Promise<string[]> {
  try {
    return (await read(directory))
      .filter(name => /^qodercli-\d/.test(name))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
      .map(name => pathApi.join(directory, name));
  } catch {
    return [];
  }
}

export function qoderInstallCommand(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32'
    ? 'npm install -g @qoder-ai/qodercli'
    : 'curl -fsSL https://qoder.com/install | bash';
}

export async function qoderExecutableCandidatePaths(
  options: QoderExecutableOptions = {},
): Promise<string[]> {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const home = options.homeDirectory ?? homedir();
  const pathApi = platformPath(platform);
  const names = executableNames('qodercli', platform);
  const versionedDirectory = pathApi.join(home, '.qoder', 'bin', 'qodercli');
  const versioned = await versionedQoderCandidates(
    versionedDirectory,
    options.readdirVersioned ??
      (async directory =>
        (await readdir(directory, { withFileTypes: true }))
          .filter(entry => entry.isFile())
          .map(entry => entry.name)),
    pathApi,
  );
  const npmDirectories = [
    options.processExecPath ? pathApi.dirname(options.processExecPath) : undefined,
    platform === 'win32' && environment.APPDATA
      ? pathApi.join(environment.APPDATA, 'npm')
      : undefined,
    pathApi.join(home, '.local', 'bin'),
    pathApi.join(home, '.qoder', 'bin'),
  ].filter((directory): directory is string => Boolean(directory));
  const candidates = [
    ...(options.configuredPath ? [options.configuredPath] : []),
    ...executableCandidatePaths('qodercli', { environment, platform }),
    ...npmDirectories.flatMap(directory => names.map(name => pathApi.join(directory, name))),
    ...versioned,
  ];
  return candidates.filter(
    (candidate, index, all) => candidate.length > 0 && all.indexOf(candidate) === index,
  );
}

export async function resolveQoderExecutable(
  options: QoderExecutableOptions = {},
): Promise<QoderExecutableResolution> {
  const platform = options.platform ?? process.platform;
  let foundCandidate = false;
  for (const candidate of await qoderExecutableCandidatePaths(options)) {
    if (!(await isExecutableFile(candidate, platform))) continue;
    foundCandidate = true;
    try {
      const version = await probeExecutableVersion(candidate, {
        environment: options.environment,
        platform,
        runner: options.runner,
      });
      return { executable: candidate, version };
    } catch {
      // Continue to the next bounded candidate without exposing local paths or command output.
    }
  }
  return {
    error: foundCandidate
      ? 'Qoder CLI candidates were found, but none passed the version probe.'
      : 'Qoder CLI was not found. Install Qoder CLI or set PANERELAY_QODER_PATH.',
  };
}
