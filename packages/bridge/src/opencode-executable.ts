import { homedir } from 'node:os';
import path from 'node:path';
import {
  executableCandidatePaths,
  executableNames,
  isExecutableFile,
  probeExecutableVersion,
  type CommandRunner,
} from './platform.js';

export interface OpenCodeExecutableResolution {
  error?: string;
  executable?: string;
  version?: string;
}

export interface OpenCodeExecutableOptions {
  configuredPath?: string;
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  processExecPath?: string;
  runner?: CommandRunner;
}

function platformPath(platform: NodeJS.Platform): typeof path.posix {
  return platform === 'win32' ? path.win32 : path.posix;
}

export function openCodeInstallCommand(): string {
  return 'npm install -g opencode-ai';
}

export function openCodeExecutableCandidatePaths(
  options: OpenCodeExecutableOptions = {},
): string[] {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const home = options.homeDirectory ?? homedir();
  const pathApi = platformPath(platform);
  const names = executableNames('opencode', platform);
  const localDirectories = [
    options.processExecPath ? pathApi.dirname(options.processExecPath) : undefined,
    platform === 'win32' && environment.APPDATA
      ? pathApi.join(environment.APPDATA, 'npm')
      : undefined,
    pathApi.join(home, '.local', 'bin'),
    pathApi.join(home, '.opencode', 'bin'),
  ].filter((directory): directory is string => Boolean(directory));
  const candidates = [
    ...(options.configuredPath ? [options.configuredPath] : []),
    ...executableCandidatePaths('opencode', { environment, platform }),
    ...localDirectories.flatMap(directory => names.map(name => pathApi.join(directory, name))),
  ];
  return candidates.filter(
    (candidate, index, all) => candidate.length > 0 && all.indexOf(candidate) === index,
  );
}

export async function resolveOpenCodeExecutable(
  options: OpenCodeExecutableOptions = {},
): Promise<OpenCodeExecutableResolution> {
  const platform = options.platform ?? process.platform;
  let foundCandidate = false;
  for (const candidate of openCodeExecutableCandidatePaths(options)) {
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
      ? 'OpenCode candidates were found, but none passed the version probe.'
      : 'OpenCode was not found. Install OpenCode or set PANERELAY_OPENCODE_PATH.',
  };
}
