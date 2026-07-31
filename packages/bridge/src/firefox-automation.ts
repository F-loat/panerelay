import { createHash, randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { probeExecutableVersion, resolveExecutablePath, type CommandRunner } from './platform.js';

export const PANERELAY_FIREFOX_MANAGED_TOKEN_ENV = 'PANERELAY_FIREFOX_MANAGED_TOKEN';
export const DEFAULT_FIREFOX_MARIONETTE_PORT = 2828;

export interface FirefoxAutomationDiscovery {
  firefoxPath?: string;
  firefoxVersion?: string;
  firefoxProfile?: string;
  geckodriverPath?: string;
  geckodriverVersion?: string;
  marionettePort: number;
}

export interface FirefoxAutomationRuntimeConfig extends FirefoxAutomationDiscovery {
  managedToken?: string;
  runtimeStatePath: string;
}

export interface FirefoxManagedRuntimeRecord {
  firefoxPath: string;
  marionettePort: number;
  pid: number;
  startedAt: string;
  tokenDigest: string;
}

export interface FirefoxAutomationDiscoveryOptions {
  environment?: NodeJS.ProcessEnv;
  firefoxPath?: string;
  firefoxProfile?: string;
  geckodriverPath?: string;
  marionettePort?: number;
  platform?: NodeJS.Platform;
  probeRunner?: CommandRunner;
}

export interface FirefoxLaunchOptions {
  environment?: NodeJS.ProcessEnv;
  spawnProcess?: typeof spawn;
}

function platformPath(platform: NodeJS.Platform): typeof path.posix {
  return platform === 'win32' ? path.win32 : path.posix;
}

export function validateFirefoxProfile(
  profile: string | undefined,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  if (profile === undefined || profile.length === 0) return undefined;
  if (
    profile.includes('\0') ||
    profile.includes('\n') ||
    profile.includes('\r') ||
    !platformPath(platform).isAbsolute(profile)
  ) {
    throw new Error('Firefox profile must be an absolute local path');
  }
  return profile;
}

export function validateMarionettePort(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error('Firefox Marionette port must be an integer from 1 through 65535');
  }
  return value;
}

function firefoxDefaultPaths(platform: NodeJS.Platform, environment: NodeJS.ProcessEnv): string[] {
  if (platform === 'darwin') {
    return [
      '/Applications/Firefox.app/Contents/MacOS/firefox',
      '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
      '/Applications/Firefox Nightly.app/Contents/MacOS/firefox',
    ];
  }
  if (platform === 'linux') {
    return ['/usr/bin/firefox', '/usr/local/bin/firefox', '/snap/bin/firefox'];
  }
  if (platform === 'win32') {
    return [environment.ProgramFiles, environment['ProgramFiles(x86)']]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map(directory => path.win32.join(directory, 'Mozilla Firefox', 'firefox.exe'));
  }
  return [];
}

export async function discoverFirefoxAutomation(
  options: FirefoxAutomationDiscoveryOptions = {},
): Promise<FirefoxAutomationDiscovery> {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const firefoxPath = await resolveExecutablePath('firefox', {
    configuredPath: options.firefoxPath ?? environment.PANERELAY_FIREFOX_PATH,
    environment,
    extraPaths: firefoxDefaultPaths(platform, environment),
    platform,
  });
  const geckodriverPath = await resolveExecutablePath('geckodriver', {
    configuredPath: options.geckodriverPath ?? environment.PANERELAY_GECKODRIVER_PATH,
    environment,
    platform,
  });
  const firefoxProfile = validateFirefoxProfile(
    options.firefoxProfile ?? environment.PANERELAY_FIREFOX_PROFILE,
    platform,
  );
  const configuredPort =
    options.marionettePort ??
    (environment.PANERELAY_FIREFOX_MARIONETTE_PORT
      ? Number(environment.PANERELAY_FIREFOX_MARIONETTE_PORT)
      : DEFAULT_FIREFOX_MARIONETTE_PORT);
  const marionettePort = validateMarionettePort(configuredPort);
  let firefoxVersion: string | undefined;
  let geckodriverVersion: string | undefined;

  if (firefoxPath) {
    try {
      firefoxVersion = await probeExecutableVersion(firefoxPath, {
        environment,
        platform,
        runner: options.probeRunner,
      });
    } catch {
      // The executable remains discoverable; doctor reports the failed probe.
    }
  }
  if (geckodriverPath) {
    try {
      geckodriverVersion = await probeExecutableVersion(geckodriverPath, {
        environment,
        platform,
        runner: options.probeRunner,
      });
    } catch {
      // The executable remains discoverable; doctor reports the failed probe.
    }
  }

  return {
    ...(firefoxPath ? { firefoxPath } : {}),
    ...(firefoxVersion ? { firefoxVersion } : {}),
    ...(firefoxProfile ? { firefoxProfile } : {}),
    ...(geckodriverPath ? { geckodriverPath } : {}),
    ...(geckodriverVersion ? { geckodriverVersion } : {}),
    marionettePort,
  };
}

export function createFirefoxManagedToken(): string {
  return randomBytes(32).toString('base64url');
}

export function firefoxManagedTokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

function quotePosix(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function escapeWindowsBatch(value: string): string {
  return value.replaceAll('%', '%%');
}

export function firefoxLauncherContent(
  hostLaunchPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === 'win32') {
    return [
      '@echo off',
      'setlocal DisableDelayedExpansion',
      `"${escapeWindowsBatch(hostLaunchPath)}" --launch-firefox %*`,
      '',
    ].join('\r\n');
  }
  return ['#!/bin/sh', `exec ${quotePosix(hostLaunchPath)} --launch-firefox "$@"`, ''].join('\n');
}

export function firefoxLaunchArguments(config: FirefoxAutomationRuntimeConfig): string[] {
  if (!config.firefoxPath) throw new Error('Firefox executable is not configured');
  const profile = validateFirefoxProfile(config.firefoxProfile);
  return ['--marionette', ...(profile ? ['--profile', profile] : [])];
}

export async function launchManagedFirefox(
  config: FirefoxAutomationRuntimeConfig,
  options: FirefoxLaunchOptions = {},
): Promise<FirefoxManagedRuntimeRecord> {
  if (!config.firefoxPath) throw new Error('Firefox executable is not configured');
  if (!config.geckodriverPath) throw new Error('geckodriver is not configured');
  if (!config.managedToken) throw new Error('Firefox automation launcher is not configured');
  validateMarionettePort(config.marionettePort);

  const environment = {
    ...(options.environment ?? process.env),
    [PANERELAY_FIREFOX_MANAGED_TOKEN_ENV]: config.managedToken,
  };
  const child: ChildProcess = (options.spawnProcess ?? spawn)(
    config.firefoxPath,
    firefoxLaunchArguments(config),
    {
      detached: true,
      env: environment,
      stdio: 'ignore',
      windowsHide: false,
    },
  );
  if (typeof child.pid !== 'number') {
    throw new Error('Firefox did not return a managed process identifier');
  }
  child.unref();

  const record: FirefoxManagedRuntimeRecord = {
    firefoxPath: config.firefoxPath,
    marionettePort: config.marionettePort,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    tokenDigest: firefoxManagedTokenDigest(config.managedToken),
  };
  await mkdir(dirname(config.runtimeStatePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${config.runtimeStatePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, config.runtimeStatePath);
  if (process.platform !== 'win32') await chmod(config.runtimeStatePath, 0o600);
  return record;
}

export async function isManagedFirefoxEnvironment(
  config: FirefoxAutomationRuntimeConfig,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const token = environment[PANERELAY_FIREFOX_MANAGED_TOKEN_ENV];
  if (!token || !config.managedToken || token !== config.managedToken) return false;
  try {
    const record = JSON.parse(
      await readFile(config.runtimeStatePath, 'utf8'),
    ) as Partial<FirefoxManagedRuntimeRecord>;
    return (
      record.firefoxPath === config.firefoxPath &&
      record.marionettePort === config.marionettePort &&
      typeof record.pid === 'number' &&
      typeof record.startedAt === 'string' &&
      record.tokenDigest === firefoxManagedTokenDigest(token)
    );
  } catch {
    return false;
  }
}
