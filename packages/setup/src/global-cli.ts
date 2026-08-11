import {
  resolveExecutablePath,
  resolveSpawnCommand,
  runCommand,
  type CommandResult,
  type CommandRunner,
} from '@panerelay/bridge/platform';
import { isPanerelayReleaseVersion } from '@panerelay/protocol';
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const GLOBAL_CLI_INSTALL_TIMEOUT_MS = 5 * 60_000;
export const GLOBAL_CLI_PROBE_TIMEOUT_MS = 10_000;
export const GLOBAL_CLI_OWNERSHIP_PROTOCOL = 'panerelay.setup-cli.v1';

export type GlobalCliOperation =
  'current' | 'installed' | 'updated' | 'preserved' | 'removed' | 'absent';

export class GlobalCliLifecycleError extends Error {
  constructor(
    readonly code: 'npm-unavailable' | 'operation-failed' | 'ownership-invalid',
    readonly operation: 'install' | 'uninstall',
  ) {
    super(
      code === 'npm-unavailable'
        ? 'npm is unavailable'
        : code === 'ownership-invalid'
          ? 'The Panerelay CLI ownership record is invalid'
          : `The global Panerelay CLI ${operation} did not complete successfully`,
    );
    this.name = 'GlobalCliLifecycleError';
  }
}

export interface GlobalCliLifecycleResult {
  executablePath?: string;
  managed: boolean;
  operation: GlobalCliOperation;
  packageSpec: string;
  version?: string;
}

export interface GlobalCliLifecycleOptions {
  cliExecutablePath?: false | string;
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  nodePath?: string;
  packageManager?: string;
  platform?: NodeJS.Platform;
  runner?: CommandRunner;
  timeoutMs?: number;
}

interface GlobalCliOwnershipRecord {
  protocol: typeof GLOBAL_CLI_OWNERSHIP_PROTOCOL;
  version: string;
}

export function globalCliOwnershipPath(homeDirectory = homedir()): string {
  return join(homeDirectory, '.panerelay', 'setup-cli.json');
}

export function globalCliPackageSpec(version: string): string {
  if (!isPanerelayReleaseVersion(version)) {
    throw new Error('The global Panerelay CLI version must be an exact Panerelay release');
  }
  return `@panerelay/cli@${version}`;
}

async function resolvePackageManager(
  options: GlobalCliLifecycleOptions,
  operation: 'install' | 'uninstall',
): Promise<string> {
  if (options.packageManager) return options.packageManager;
  const environment = options.environment ?? process.env;
  const nodePath = options.nodePath ?? process.execPath;
  const packageManager = await resolveExecutablePath('npm', {
    environment,
    extraDirectories: [dirname(nodePath)],
    platform: options.platform,
  });
  if (!packageManager) throw new GlobalCliLifecycleError('npm-unavailable', operation);
  return packageManager;
}

async function runNpm(
  packageManager: string,
  args: string[],
  options: GlobalCliLifecycleOptions,
  operation: 'install' | 'uninstall',
): Promise<CommandResult> {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const launch = resolveSpawnCommand(packageManager, args, platform, environment.ComSpec);
  try {
    return await (options.runner ?? runCommand)(launch.command, launch.args, {
      environment,
      timeoutMs: options.timeoutMs ?? GLOBAL_CLI_INSTALL_TIMEOUT_MS,
      windowsVerbatimArguments: launch.windowsVerbatimArguments,
    });
  } catch {
    throw new GlobalCliLifecycleError('operation-failed', operation);
  }
}

function isProjectPackageExecutable(filePath: string): boolean {
  return filePath.replaceAll('\\', '/').includes('/node_modules/.bin/');
}

async function existingGlobalCliExecutable(
  options: GlobalCliLifecycleOptions,
): Promise<string | undefined> {
  if (options.cliExecutablePath === false) return undefined;
  const executablePath =
    options.cliExecutablePath ??
    (await resolveExecutablePath('panerelay', {
      environment: options.environment ?? process.env,
      platform: options.platform,
    }));
  return executablePath && !isProjectPackageExecutable(executablePath) ? executablePath : undefined;
}

async function executableVersion(
  executablePath: string,
  options: GlobalCliLifecycleOptions,
): Promise<string | undefined> {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const launch = resolveSpawnCommand(executablePath, ['--version'], platform, environment.ComSpec);
  try {
    const result = await (options.runner ?? runCommand)(launch.command, launch.args, {
      environment,
      timeoutMs: Math.min(
        options.timeoutMs ?? GLOBAL_CLI_PROBE_TIMEOUT_MS,
        GLOBAL_CLI_PROBE_TIMEOUT_MS,
      ),
      windowsVerbatimArguments: launch.windowsVerbatimArguments,
    });
    if (result.code !== 0) return undefined;
    const value = result.stdout.trim().replace(/^v/, '');
    return isPanerelayReleaseVersion(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function globalCliVersion(
  packageManager: string,
  options: GlobalCliLifecycleOptions,
  operation: 'install' | 'uninstall',
): Promise<string | undefined> {
  const result = await runNpm(
    packageManager,
    ['list', '--global', '--depth=0', '--json', '@panerelay/cli'],
    options,
    operation,
  );
  let manifest: unknown;
  try {
    manifest = JSON.parse(result.stdout);
  } catch {
    throw new GlobalCliLifecycleError('operation-failed', operation);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new GlobalCliLifecycleError('operation-failed', operation);
  }
  const dependencies = (manifest as { dependencies?: unknown }).dependencies;
  if (dependencies === undefined) return undefined;
  if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
    throw new GlobalCliLifecycleError('operation-failed', operation);
  }
  const installed = (dependencies as Record<string, unknown>)['@panerelay/cli'];
  if (installed === undefined) return undefined;
  if (!installed || typeof installed !== 'object' || Array.isArray(installed)) {
    throw new GlobalCliLifecycleError('operation-failed', operation);
  }
  const version = (installed as { version?: unknown }).version;
  if (!isPanerelayReleaseVersion(version)) {
    throw new GlobalCliLifecycleError('operation-failed', operation);
  }
  return version;
}

async function readOwnership(
  filePath: string,
  platform: NodeJS.Platform,
  operation: 'install' | 'uninstall',
): Promise<GlobalCliOwnershipRecord | undefined> {
  let fileStat;
  try {
    fileStat = await lstat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  if (
    !fileStat.isFile() ||
    fileStat.isSymbolicLink() ||
    fileStat.size > 1_024 ||
    (platform !== 'win32' && (fileStat.mode & 0o022) !== 0)
  ) {
    throw new GlobalCliLifecycleError('ownership-invalid', operation);
  }
  try {
    const value = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
    if (
      Object.keys(value).length !== 2 ||
      value.protocol !== GLOBAL_CLI_OWNERSHIP_PROTOCOL ||
      !isPanerelayReleaseVersion(value.version)
    ) {
      throw new Error('invalid');
    }
    return {
      protocol: GLOBAL_CLI_OWNERSHIP_PROTOCOL,
      version: value.version,
    };
  } catch {
    throw new GlobalCliLifecycleError('ownership-invalid', operation);
  }
}

async function writeOwnership(filePath: string, version: string): Promise<void> {
  const directory = dirname(filePath);
  const temporaryPath = join(
    directory,
    `.setup-cli.${process.pid}.${randomBytes(8).toString('hex')}.tmp`,
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify({ protocol: GLOBAL_CLI_OWNERSHIP_PROTOCOL, version }, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 },
    );
    await rm(filePath, { force: true });
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function installGlobalPanerelayCli(
  version: string,
  options: GlobalCliLifecycleOptions = {},
): Promise<GlobalCliLifecycleResult> {
  const packageSpec = globalCliPackageSpec(version);
  const platform = options.platform ?? process.platform;
  const ownershipPath = globalCliOwnershipPath(options.homeDirectory);
  const [ownership, executablePath] = await Promise.all([
    readOwnership(ownershipPath, platform, 'install'),
    existingGlobalCliExecutable(options),
  ]);
  if (executablePath && !ownership) {
    const versionOnPath = await executableVersion(executablePath, options);
    return {
      executablePath,
      managed: false,
      operation: 'preserved',
      packageSpec,
      ...(versionOnPath ? { version: versionOnPath } : {}),
    };
  }
  const packageManager = await resolvePackageManager(options, 'install');
  const existingVersion = await globalCliVersion(packageManager, options, 'install');

  if (executablePath && ownership && !existingVersion) {
    await rm(ownershipPath, { force: true });
    const versionOnPath = await executableVersion(executablePath, options);
    return {
      executablePath,
      managed: false,
      operation: 'preserved',
      packageSpec,
      ...(versionOnPath ? { version: versionOnPath } : {}),
    };
  }

  if (existingVersion && !ownership) {
    return {
      ...(executablePath ? { executablePath } : {}),
      managed: false,
      operation: 'preserved',
      packageSpec,
      version: existingVersion,
    };
  }
  if (existingVersion && ownership && existingVersion !== ownership.version) {
    await rm(ownershipPath, { force: true });
    return {
      ...(executablePath ? { executablePath } : {}),
      managed: false,
      operation: 'preserved',
      packageSpec,
      version: existingVersion,
    };
  }
  if (existingVersion === version) {
    return {
      ...(executablePath ? { executablePath } : {}),
      managed: true,
      operation: 'current',
      packageSpec,
      version,
    };
  }

  const result = await runNpm(
    packageManager,
    ['install', '--global', '--no-audit', '--no-fund', '--loglevel=error', packageSpec],
    options,
    'install',
  );
  if (result.code !== 0) throw new GlobalCliLifecycleError('operation-failed', 'install');
  await writeOwnership(ownershipPath, version);
  const installedExecutablePath = await existingGlobalCliExecutable(options);
  return {
    ...(installedExecutablePath ? { executablePath: installedExecutablePath } : {}),
    managed: true,
    operation: existingVersion ? 'updated' : 'installed',
    packageSpec,
    version,
  };
}

export async function uninstallGlobalPanerelayCli(
  options: GlobalCliLifecycleOptions = {},
): Promise<GlobalCliLifecycleResult> {
  const platform = options.platform ?? process.platform;
  const ownershipPath = globalCliOwnershipPath(options.homeDirectory);
  const [ownership, executablePath] = await Promise.all([
    readOwnership(ownershipPath, platform, 'uninstall'),
    existingGlobalCliExecutable(options),
  ]);
  if (!ownership) {
    const versionOnPath = executablePath
      ? await executableVersion(executablePath, options)
      : undefined;
    return {
      ...(executablePath ? { executablePath } : {}),
      managed: false,
      operation: executablePath ? 'preserved' : 'absent',
      packageSpec: '@panerelay/cli',
      ...(versionOnPath ? { version: versionOnPath } : {}),
    };
  }
  const packageManager = await resolvePackageManager(options, 'uninstall');
  const existingVersion = await globalCliVersion(packageManager, options, 'uninstall');

  if (
    (executablePath && !existingVersion) ||
    (existingVersion && existingVersion !== ownership.version)
  ) {
    await rm(ownershipPath, { force: true });
    return {
      ...(executablePath ? { executablePath } : {}),
      managed: false,
      operation: executablePath || existingVersion ? 'preserved' : 'absent',
      packageSpec: '@panerelay/cli',
      ...(existingVersion ? { version: existingVersion } : {}),
    };
  }
  if (!existingVersion) {
    await rm(ownershipPath, { force: true });
    return { managed: true, operation: 'absent', packageSpec: '@panerelay/cli' };
  }

  const result = await runNpm(
    packageManager,
    ['uninstall', '--global', '--no-audit', '--no-fund', '--loglevel=error', '@panerelay/cli'],
    options,
    'uninstall',
  );
  if (result.code !== 0) throw new GlobalCliLifecycleError('operation-failed', 'uninstall');
  await rm(ownershipPath, { force: true });
  return {
    managed: true,
    operation: 'removed',
    packageSpec: '@panerelay/cli',
    version: existingVersion,
  };
}
