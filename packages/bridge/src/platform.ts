import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export interface SpawnCommand {
  args: string[];
  command: string;
  windowsVerbatimArguments?: boolean;
}

export interface CommandResult {
  code: number;
  stderr: string;
  stdout: string;
}

export interface RunCommandOptions {
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  windowsVerbatimArguments?: boolean;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options?: RunCommandOptions,
) => Promise<CommandResult>;

export type AccessFile = (filePath: string, mode: number) => Promise<void>;

export interface ExecutableCandidateOptions {
  configuredPath?: string;
  environment?: NodeJS.ProcessEnv;
  extraDirectories?: string[];
  extraPaths?: string[];
  platform?: NodeJS.Platform;
}

export interface ResolveExecutableOptions extends ExecutableCandidateOptions {
  accessFile?: AccessFile;
}

export interface VersionProbeOptions {
  args?: string[];
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  runner?: CommandRunner;
  timeoutMs?: number;
}

const MAX_CAPTURE_LENGTH = 64 * 1024;
const MAX_PATH_ENTRIES = 64;
const MAX_PATH_ENTRY_LENGTH = 2_048;
const MAX_PATH_TOTAL_LENGTH = 32 * 1024;
const WINDOWS_COMMAND_META_CHARACTERS = /([()%!^"`<>&|;, *?])/g;

function escapeWindowsCommand(value: string): string {
  return value.replace(WINDOWS_COMMAND_META_CHARACTERS, '^$1');
}

function escapeWindowsArgument(value: string): string {
  const escapedQuotes = value
    .replace(/(?=(\\+?)?)\1"/g, '$1$1\\"')
    .replace(/(?=(\\+?)?)\1$/, '$1$1');
  return `"${escapedQuotes}"`.replace(WINDOWS_COMMAND_META_CHARACTERS, '^$1');
}

function platformPath(platform: NodeJS.Platform): typeof path.posix {
  return platform === 'win32' ? path.win32 : path.posix;
}

function environmentPath(environment: NodeJS.ProcessEnv): string {
  const pathKey = Object.keys(environment).find(key => key.toLowerCase() === 'path');
  return (pathKey && environment[pathKey]) || '';
}

function environmentPathKey(environment: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  return (
    Object.keys(environment).find(key => key.toLowerCase() === 'path') ||
    (platform === 'win32' ? 'Path' : 'PATH')
  );
}

export function normalizeExecutablePathEntries(
  entries: readonly unknown[],
  platform: NodeJS.Platform = process.platform,
): string[] {
  const pathApi = platformPath(platform);
  const normalized: string[] = [];
  const seen = new Set<string>();
  let totalLength = 0;
  for (const value of entries) {
    if (normalized.length >= MAX_PATH_ENTRIES) break;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PATH_ENTRY_LENGTH || !pathApi.isAbsolute(trimmed)) {
      continue;
    }
    const entry = pathApi.normalize(trimmed);
    const key = platform === 'win32' ? entry.toLocaleLowerCase('en-US') : entry;
    if (seen.has(key)) continue;
    if (totalLength + entry.length > MAX_PATH_TOTAL_LENGTH) break;
    seen.add(key);
    normalized.push(entry);
    totalLength += entry.length;
  }
  return normalized;
}

export function executablePathEntries(
  environment: NodeJS.ProcessEnv,
  options: { platform?: NodeJS.Platform; prepend?: readonly string[] } = {},
): string[] {
  const platform = options.platform ?? process.platform;
  return normalizeExecutablePathEntries(
    [
      ...(options.prepend ?? []),
      ...environmentPath(environment).split(platform === 'win32' ? ';' : ':'),
    ],
    platform,
  );
}

export function environmentWithExecutablePath(
  environment: NodeJS.ProcessEnv,
  capturedEntries: readonly unknown[],
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const pathKey = environmentPathKey(environment, platform);
  const entries = normalizeExecutablePathEntries(
    [...capturedEntries, ...environmentPath(environment).split(platform === 'win32' ? ';' : ':')],
    platform,
  );
  return {
    ...environment,
    [pathKey]: entries.join(platform === 'win32' ? ';' : ':'),
  };
}

export function executableNames(
  name: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  if (platform !== 'win32' || /\.(?:cmd|bat|exe)$/i.test(name)) return [name];
  return [`${name}.cmd`, `${name}.exe`, name];
}

export function executableCandidatePaths(
  name: string,
  options: ExecutableCandidateOptions = {},
): string[] {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const pathApi = platformPath(platform);
  const candidates: string[] = [];
  if (options.configuredPath) candidates.push(options.configuredPath);
  candidates.push(...(options.extraPaths ?? []));

  const directories = [
    ...(options.extraDirectories ?? []),
    ...environmentPath(environment)
      .split(platform === 'win32' ? ';' : ':')
      .filter(Boolean),
  ];
  for (const directory of directories) {
    for (const executableName of executableNames(name, platform)) {
      candidates.push(pathApi.join(directory, executableName));
    }
  }
  if (pathApi.isAbsolute(name)) candidates.unshift(name);
  return candidates.filter(
    (candidate, index, all) => candidate.length > 0 && all.indexOf(candidate) === index,
  );
}

export async function isExecutableFile(
  filePath: string,
  platform: NodeJS.Platform = process.platform,
  accessFile: AccessFile = async (candidate, mode) => access(candidate, mode),
): Promise<boolean> {
  try {
    await accessFile(filePath, platform === 'win32' ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveExecutablePath(
  name: string,
  options: ResolveExecutableOptions = {},
): Promise<string | undefined> {
  const platform = options.platform ?? process.platform;
  for (const candidate of executableCandidatePaths(name, options)) {
    if (await isExecutableFile(candidate, platform, options.accessFile)) return candidate;
  }
  return undefined;
}

export function resolveSpawnCommand(
  executable: string,
  args: string[],
  platform: NodeJS.Platform = process.platform,
  commandInterpreter: string | undefined = process.env.ComSpec,
): SpawnCommand {
  if (platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable)) {
    // cmd.exe must receive one pre-escaped command string or paths containing spaces are reparsed.
    const shellCommand = [
      escapeWindowsCommand(executable),
      ...args.map(argument => escapeWindowsArgument(argument)),
    ].join(' ');
    return {
      command: commandInterpreter || 'cmd.exe',
      args: ['/d', '/s', '/c', `"${shellCommand}"`],
      windowsVerbatimArguments: true,
    };
  }
  return { command: executable, args };
}

export const runCommand: CommandRunner = (command, args, options: RunCommandOptions = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsVerbatimArguments: options.windowsVerbatimArguments,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const append = (current: string, chunk: Buffer): string =>
      current.length >= MAX_CAPTURE_LENGTH
        ? current
        : `${current}${chunk.toString('utf8')}`.slice(0, MAX_CAPTURE_LENGTH);
    const finish = (error?: Error, code = 1): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (error) reject(error);
      else resolve({ code, stdout, stderr });
    };
    child.stdout.on('data', chunk => {
      stdout = append(stdout, chunk as Buffer);
    });
    child.stderr.on('data', chunk => {
      stderr = append(stderr, chunk as Buffer);
    });
    child.once('error', error => finish(error));
    child.once('exit', code => finish(undefined, code ?? 1));
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            child.kill();
            finish(new Error(`Command timed out after ${options.timeoutMs}ms`));
          }, options.timeoutMs);
  });

export function parseCliVersion(output: string): string | undefined {
  return /(?:^|[^0-9])(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:$|[^0-9A-Za-z.-])/.exec(
    output.trim(),
  )?.[1];
}

export async function probeExecutableVersion(
  executable: string,
  options: VersionProbeOptions = {},
): Promise<string> {
  const launch = resolveSpawnCommand(
    executable,
    options.args ?? ['--version'],
    options.platform,
    options.environment?.ComSpec,
  );
  const result = await (options.runner ?? runCommand)(launch.command, launch.args, {
    environment: options.environment,
    timeoutMs: options.timeoutMs ?? 5_000,
    windowsVerbatimArguments: launch.windowsVerbatimArguments,
  });
  if (result.code !== 0) {
    throw new Error(`Version probe exited with code ${result.code}`);
  }
  const version = parseCliVersion(`${result.stdout}\n${result.stderr}`);
  if (!version) throw new Error('Version probe did not return a semantic version');
  return version;
}

export function compareVersions(left: string, right: string): number {
  const parse = (value: string): [number, number, number] => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-|$)/.exec(value);
    if (!match) throw new Error(`Invalid semantic version: ${value}`);
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

export function userHomeDirectory(): string {
  return homedir();
}
