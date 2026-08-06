import { dirname } from 'node:path';
import {
  isPanerelayReleaseVersion,
  nativeHostManualUpdateCommand,
  type HostUpdateError,
} from '@panerelay/protocol';
import {
  resolveExecutablePath,
  resolveSpawnCommand,
  runCommand,
  type CommandRunner,
} from './platform.js';

export const NATIVE_HOST_UPDATE_TIMEOUT_MS = 5 * 60_000;

export interface NativeHostUpdateCommand {
  args: string[];
  manualCommand: string;
  packageSpec: string;
}

export interface RunNativeHostUpdateOptions {
  environment?: NodeJS.ProcessEnv;
  nodePath?: string;
  packageRunner?: string;
  platform?: NodeJS.Platform;
  runner?: CommandRunner;
  timeoutMs?: number;
}

export class NativeHostUpdateFailure extends Error {
  constructor(
    readonly updateError: HostUpdateError,
    message: string,
  ) {
    super(message);
    this.name = 'NativeHostUpdateFailure';
  }
}

function classifyUpdateFailure(output: string): HostUpdateError {
  if (
    /\b(?:E404|ETARGET)\b|no matching version found|404\s+not found|package.+not found/i.test(
      output,
    )
  ) {
    return 'package-unavailable';
  }
  if (
    /\b(?:EAI_AGAIN|ECONNREFUSED|ECONNRESET|ENETUNREACH|ENOTFOUND|ERR_SOCKET_TIMEOUT)\b|fetch failed|network request/i.test(
      output,
    )
  ) {
    return 'network';
  }
  return 'setup-failed';
}

export function nativeHostUpdateCommand(targetVersion: string): NativeHostUpdateCommand {
  if (!isPanerelayReleaseVersion(targetVersion)) {
    throw new Error('The Native Host update target must be a valid Panerelay release');
  }
  const packageSpec = `@panerelay/setup@${targetVersion}`;
  return {
    args: ['--yes', packageSpec, 'update', '--yes'],
    manualCommand: nativeHostManualUpdateCommand(targetVersion),
    packageSpec,
  };
}

export async function runNativeHostUpdate(
  targetVersion: string,
  options: RunNativeHostUpdateOptions = {},
): Promise<void> {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const command = nativeHostUpdateCommand(targetVersion);
  const packageRunner =
    options.packageRunner ??
    (await resolveExecutablePath('npx', {
      environment,
      extraDirectories: [dirname(options.nodePath ?? process.execPath)],
      platform,
    }));
  if (!packageRunner) {
    throw new NativeHostUpdateFailure('package-unavailable', 'The package runner is unavailable');
  }
  const launch = resolveSpawnCommand(packageRunner, command.args, platform, environment.ComSpec);
  let result;
  try {
    result = await (options.runner ?? runCommand)(launch.command, launch.args, {
      environment,
      timeoutMs: options.timeoutMs ?? NATIVE_HOST_UPDATE_TIMEOUT_MS,
      windowsVerbatimArguments: launch.windowsVerbatimArguments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const classified = classifyUpdateFailure(message);
    throw new NativeHostUpdateFailure(
      /timed out/i.test(message)
        ? 'timeout'
        : classified === 'setup-failed'
          ? 'unknown'
          : classified,
      'The Native Host update process did not complete',
    );
  }
  if (result.code !== 0) {
    const category = classifyUpdateFailure(
      `${result.stderr.slice(0, 8_192)}\n${result.stdout.slice(0, 8_192)}`,
    );
    throw new NativeHostUpdateFailure(category, 'The exact Native Host setup failed');
  }
}
