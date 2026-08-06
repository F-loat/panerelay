import { randomBytes } from 'node:crypto';
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, win32 } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  PANERELAY_EXTENSION_ID,
  PANERELAY_NATIVE_HOST_NAME,
  PANERELAY_PROTOCOL_VERSION,
  isPanerelayReleaseVersion,
} from '@panerelay/protocol';
import {
  probeExecutableVersion,
  resolveExecutablePath,
  runCommand,
  executablePathEntries,
  type CommandRunner,
} from './platform.js';
import { resolveOpenCodeExecutable } from './providers/opencode/executable.js';
import { resolveQoderExecutable } from './providers/qoder/executable.js';

export const CHROME_EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

export interface NativeHostPathOptions {
  dataDirectory?: string;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  userDataDirectory?: string;
}

export interface NativeHostInstallOptions extends NativeHostPathOptions {
  bundledHostPath?: string;
  environment?: NodeJS.ProcessEnv;
  expectedReleaseVersion?: string;
  extensionId?: string;
  nodePath?: string;
  lockPollMs?: number;
  lockStaleMs?: number;
  lockTimeoutMs?: number;
  isProcessAlive?: (pid: number) => boolean;
  probeRunner?: CommandRunner;
  registryRunner?: CommandRunner;
  selfCheckRunner?: CommandRunner;
}

export interface NativeHostUninstallOptions extends NativeHostPathOptions {
  environment?: NodeJS.ProcessEnv;
  registryRunner?: CommandRunner;
}

export interface NativeHostInstallationPaths {
  currentVersionPath: string;
  hostPath: string;
  hostsDirectory: string;
  launchPath: string;
  launcherPath?: string;
  legacyHostPath: string;
  manifestPaths: string[];
  runtimeConfigPath: string;
  updateLockPath: string;
}

export interface NativeHostInstallationResult extends NativeHostInstallationPaths {
  codexPath?: string;
  claudePath?: string;
  claudeVersion?: string;
  extensionId: string;
  releaseVersion: string;
  selectedHostPath: string;
  qoderPath?: string;
  qoderVersion?: string;
  opencodePath?: string;
  opencodeVersion?: string;
}

interface StoredRuntimeConfig {
  agentPathEntries?: unknown;
  claudePath?: unknown;
  claudeVersion?: unknown;
  codexPath?: unknown;
  extensionId?: unknown;
  opencodePath?: unknown;
  qoderPath?: unknown;
}

export interface NativeHostVersionPointer {
  version: string;
}

export interface NativeHostSelfCheck {
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  release: string;
}

export interface NativeHostUpdateLockRecord {
  pid: number;
  startedAt: number;
  targetVersion: string;
}

export interface NativeHostUpdateLockLease {
  record: NativeHostUpdateLockRecord;
  release: () => Promise<void>;
}

export interface NativeHostUpdateLockOptions {
  isProcessAlive?: (pid: number) => boolean;
  now?: () => number;
  platform?: NodeJS.Platform;
  pollMs?: number;
  staleMs?: number;
  timeoutMs?: number;
}

const NATIVE_HOST_BUNDLE_FILENAME = 'native-host.bundle.cjs';
const NATIVE_HOST_POINTER_MAX_BYTES = 512;
const NATIVE_HOST_UPDATE_LOCK_MAX_BYTES = 512;

export type WindowsNativeMessagingBrowser = 'chrome' | 'edge';

export function validateExtensionId(value: string): string {
  if (!CHROME_EXTENSION_ID_PATTERN.test(value)) {
    throw new Error('Extension ID must contain exactly 32 lowercase letters from a through p.');
  }
  return value;
}

export function resolveEffectiveExtensionId(options: {
  environment?: NodeJS.ProcessEnv;
  extensionId?: string;
  persistedExtensionId?: unknown;
}): string {
  const environment = options.environment ?? process.env;
  const value =
    options.extensionId ??
    environment.PANERELAY_EXTENSION_ID ??
    (typeof options.persistedExtensionId === 'string'
      ? options.persistedExtensionId
      : PANERELAY_EXTENSION_ID);
  return validateExtensionId(value);
}

export function windowsNativeHostRegistryKey(
  hostName = PANERELAY_NATIVE_HOST_NAME,
  browser: WindowsNativeMessagingBrowser = 'chrome',
): string {
  const owner = browser === 'edge' ? 'Microsoft\\Edge' : 'Google\\Chrome';
  return `HKCU\\SOFTWARE\\${owner}\\NativeMessagingHosts\\${hostName}`;
}

export async function registerWindowsNativeHost(
  manifestPath: string,
  options: {
    browser?: WindowsNativeMessagingBrowser;
    environment?: NodeJS.ProcessEnv;
    runner?: CommandRunner;
  } = {},
): Promise<void> {
  const result = await (options.runner ?? runCommand)(
    'reg.exe',
    [
      'add',
      windowsNativeHostRegistryKey(PANERELAY_NATIVE_HOST_NAME, options.browser),
      '/ve',
      '/t',
      'REG_SZ',
      '/d',
      manifestPath,
      '/f',
    ],
    { environment: options.environment, timeoutMs: 10_000 },
  );
  if (result.code !== 0) {
    throw new Error(`Windows Native Messaging registration failed with code ${result.code}`);
  }
}

export async function unregisterWindowsNativeHost(
  options: {
    browser?: WindowsNativeMessagingBrowser;
    environment?: NodeJS.ProcessEnv;
    runner?: CommandRunner;
  } = {},
): Promise<void> {
  const result = await (options.runner ?? runCommand)(
    'reg.exe',
    ['delete', windowsNativeHostRegistryKey(PANERELAY_NATIVE_HOST_NAME, options.browser), '/f'],
    { environment: options.environment, timeoutMs: 10_000 },
  );
  if (result.code !== 0 && result.code !== 1) {
    throw new Error(`Windows Native Messaging cleanup failed with code ${result.code}`);
  }
}

export function parseWindowsRegistryString(output: string): string | undefined {
  for (const line of output.split(/\r?\n/)) {
    const marker = line.indexOf('REG_SZ');
    if (marker < 0) continue;
    const value = line.slice(marker + 'REG_SZ'.length).trim();
    if (value) return value;
  }
  return undefined;
}

export async function readWindowsNativeHostRegistryValue(
  options: {
    browser?: WindowsNativeMessagingBrowser;
    environment?: NodeJS.ProcessEnv;
    runner?: CommandRunner;
  } = {},
): Promise<string | undefined> {
  const result = await (options.runner ?? runCommand)(
    'reg.exe',
    ['query', windowsNativeHostRegistryKey(PANERELAY_NATIVE_HOST_NAME, options.browser), '/ve'],
    { environment: options.environment, timeoutMs: 10_000 },
  );
  if (result.code !== 0) return undefined;
  return parseWindowsRegistryString(result.stdout);
}

export function windowsLauncherContent(nodePath: string, hostPath: string): string {
  const escapePercent = (value: string): string => value.replaceAll('%', '%%');
  return [
    '@echo off',
    'setlocal DisableDelayedExpansion',
    `"${escapePercent(nodePath)}" "${escapePercent(hostPath)}" %*`,
    '',
  ].join('\r\n');
}

export function nativeHostLauncherContent(nodePath = '/usr/bin/env node'): string {
  return `${[
    `#!${nodePath}`,
    "'use strict';",
    "const { lstatSync, readFileSync } = require('node:fs');",
    "const { resolve } = require('node:path');",
    "const { spawnSync } = require('node:child_process');",
    'const fail = message => { process.stderr.write(`[Panerelay] ${message}\\n`); process.exit(1); };',
    "const root = resolve(__dirname, '..');",
    "const pointerPath = resolve(root, 'host-current.json');",
    'let pointerStat;',
    "try { pointerStat = lstatSync(pointerPath); } catch { fail('Native Host version pointer is unavailable'); }",
    "if (!pointerStat.isFile() || pointerStat.isSymbolicLink()) fail('Native Host version pointer is unsafe');",
    "if (pointerStat.size > 512) fail('Native Host version pointer is oversized');",
    "if (process.platform !== 'win32' && (pointerStat.mode & 0o022) !== 0) fail('Native Host version pointer permissions are unsafe');",
    "if (process.getuid && pointerStat.uid !== process.getuid()) fail('Native Host version pointer owner is unsafe');",
    'let pointer;',
    "try { pointer = JSON.parse(readFileSync(pointerPath, 'utf8')); } catch { fail('Native Host version pointer is malformed'); }",
    'const releasePattern = /^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-beta\\.(0|[1-9]\\d*))?$/;',
    "if (!pointer || typeof pointer !== 'object' || Array.isArray(pointer) || Object.keys(pointer).length !== 1 || typeof pointer.version !== 'string' || pointer.version.length > 64 || !releasePattern.test(pointer.version)) fail('Native Host version pointer is invalid');",
    "if (pointer.version.split(/\\.|-beta\\./).some(value => Number(value) > 65535)) fail('Native Host version pointer is invalid');",
    "const versionDirectory = resolve(root, 'hosts', pointer.version);",
    "const bundlePath = resolve(versionDirectory, 'native-host.bundle.cjs');",
    'let versionStat; let bundleStat;',
    "try { versionStat = lstatSync(versionDirectory); bundleStat = lstatSync(bundlePath); } catch { fail('Selected Native Host bundle is unavailable'); }",
    "if (!versionStat.isDirectory() || versionStat.isSymbolicLink() || !bundleStat.isFile() || bundleStat.isSymbolicLink()) fail('Selected Native Host bundle is unsafe');",
    "const result = spawnSync(process.execPath, [bundlePath, ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true });",
    "if (result.error) fail('Selected Native Host bundle failed to launch');",
    'if (result.signal) process.kill(process.pid, result.signal);',
    'process.exit(result.status ?? 1);',
  ].join('\n')}\n`;
}

export function resolveNativeHostInstallationPaths(
  options: NativeHostPathOptions = {},
): NativeHostInstallationPaths {
  const home = options.homeDirectory ?? homedir();
  const dataDirectory = options.dataDirectory ?? join(home, '.panerelay');
  const hostDirectory = join(dataDirectory, 'bin');
  const hostPath = join(hostDirectory, 'panerelay-native-host.cjs');
  const hostsDirectory = join(dataDirectory, 'hosts');
  const platform = options.platform ?? process.platform;
  const launcherPath =
    platform === 'win32' ? join(hostDirectory, 'panerelay-native-host.cmd') : undefined;
  return {
    currentVersionPath: join(dataDirectory, 'host-current.json'),
    hostPath,
    hostsDirectory,
    launchPath: launcherPath ?? hostPath,
    ...(launcherPath ? { launcherPath } : {}),
    legacyHostPath: join(hostDirectory, 'panerelay-native-host.mjs'),
    manifestPaths: nativeHostManifestPaths({ ...options, dataDirectory }),
    runtimeConfigPath: join(dataDirectory, 'runtime.json'),
    updateLockPath: join(dataDirectory, 'update.lock'),
  };
}

export function nativeHostManifestPaths(options: NativeHostPathOptions = {}): string[] {
  const home = options.homeDirectory ?? homedir();
  const filename = `${PANERELAY_NATIVE_HOST_NAME}.json`;
  const dataDirectory = options.dataDirectory ?? join(home, '.panerelay');
  const profilePaths = options.userDataDirectory
    ? [join(options.userDataDirectory, 'NativeMessagingHosts', filename)]
    : [];

  switch (options.platform ?? process.platform) {
    case 'darwin': {
      const browserPaths = [
        ['Google', 'Chrome'],
        ['Google', 'Chrome Beta'],
        ['Google', 'Chrome Dev'],
        ['Google', 'Chrome Canary'],
        ['Google', 'Chrome for Testing'],
        ['Chromium'],
        ['Microsoft Edge'],
        ['Microsoft Edge Beta'],
        ['Microsoft Edge Dev'],
        ['Microsoft Edge Canary'],
      ].map(parts =>
        join(home, 'Library', 'Application Support', ...parts, 'NativeMessagingHosts', filename),
      );
      return [...profilePaths, ...browserPaths];
    }
    case 'linux': {
      const browserPaths = [
        'google-chrome',
        'google-chrome-beta',
        'google-chrome-unstable',
        'google-chrome-for-testing',
        'chromium',
        'microsoft-edge',
        'microsoft-edge-beta',
        'microsoft-edge-dev',
      ].map(browser => join(home, '.config', browser, 'NativeMessagingHosts', filename));
      return [...profilePaths, ...browserPaths];
    }
    case 'win32':
      return [join(dataDirectory, 'native-messaging', filename)];
    default:
      throw new Error(
        `Native Messaging installation is not implemented for ${options.platform ?? process.platform}`,
      );
  }
}

async function persistedRuntimeConfig(path: string): Promise<StoredRuntimeConfig> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as StoredRuntimeConfig;
  } catch {
    return {};
  }
}

async function writeProtectedFile(path: string, content: string, mode: number): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporaryPath, content, { flag: 'wx', mode });
    if (process.platform !== 'win32') await chmod(temporaryPath, mode);
    await rename(temporaryPath, path);
    if (process.platform !== 'win32') await chmod(path, mode);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function parseNativeHostVersionPointer(value: unknown): NativeHostVersionPointer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const pointer = value as Record<string, unknown>;
  if (Object.keys(pointer).length !== 1 || !isPanerelayReleaseVersion(pointer.version)) {
    return null;
  }
  return { version: pointer.version };
}

export async function readNativeHostVersionPointer(
  path: string,
  platform: NodeJS.Platform = process.platform,
): Promise<NativeHostVersionPointer> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > NATIVE_HOST_POINTER_MAX_BYTES) {
    throw new Error('The Native Host version pointer is not a protected regular file');
  }
  if (platform !== 'win32') {
    if ((info.mode & 0o022) !== 0) {
      throw new Error('The Native Host version pointer permissions are unsafe');
    }
    if (typeof process.getuid === 'function' && info.uid !== process.getuid()) {
      throw new Error('The Native Host version pointer owner is unsafe');
    }
  }
  const content = await readFile(path, 'utf8');
  const pointer = parseNativeHostVersionPointer(JSON.parse(content) as unknown);
  if (!pointer) throw new Error('The Native Host version pointer is malformed');
  return pointer;
}

async function optionalNativeHostVersionPointer(
  path: string,
  platform: NodeJS.Platform,
): Promise<NativeHostVersionPointer | undefined> {
  try {
    return await readNativeHostVersionPointer(path, platform);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function nativeHostProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function readNativeHostUpdateLock(
  path: string,
  platform: NodeJS.Platform,
): Promise<{ info: Awaited<ReturnType<typeof lstat>>; record: NativeHostUpdateLockRecord }> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > NATIVE_HOST_UPDATE_LOCK_MAX_BYTES) {
    throw new Error('The Native Host update lock is not a protected regular file');
  }
  if (platform !== 'win32') {
    if ((info.mode & 0o022) !== 0)
      throw new Error('The Native Host update lock permissions are unsafe');
    if (typeof process.getuid === 'function' && info.uid !== process.getuid()) {
      throw new Error('The Native Host update lock owner is unsafe');
    }
  }
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
    throw new Error('The Native Host update lock is malformed', { cause: error });
  }
  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
  } catch {
    throw new Error('The Native Host update lock is malformed');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The Native Host update lock is malformed');
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(',') !== 'pid,startedAt,targetVersion' ||
    typeof record.pid !== 'number' ||
    !Number.isSafeInteger(record.pid) ||
    record.pid <= 0 ||
    typeof record.startedAt !== 'number' ||
    !Number.isSafeInteger(record.startedAt) ||
    record.startedAt <= 0 ||
    !isPanerelayReleaseVersion(record.targetVersion)
  ) {
    throw new Error('The Native Host update lock is malformed');
  }
  return {
    info,
    record: {
      pid: record.pid,
      startedAt: record.startedAt,
      targetVersion: record.targetVersion,
    },
  };
}

export async function readNativeHostUpdateLockRecord(
  path: string,
  platform: NodeJS.Platform = process.platform,
): Promise<NativeHostUpdateLockRecord> {
  return (await readNativeHostUpdateLock(path, platform)).record;
}

async function removeMatchingNativeHostUpdateLock(
  path: string,
  expected: { info: Awaited<ReturnType<typeof lstat>>; record: NativeHostUpdateLockRecord },
  platform: NodeJS.Platform,
): Promise<boolean> {
  let current: Awaited<ReturnType<typeof readNativeHostUpdateLock>>;
  try {
    current = await readNativeHostUpdateLock(path, platform);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  if (
    current.info.dev !== expected.info.dev ||
    current.info.ino !== expected.info.ino ||
    current.record.pid !== expected.record.pid ||
    current.record.startedAt !== expected.record.startedAt ||
    current.record.targetVersion !== expected.record.targetVersion
  ) {
    return false;
  }
  await rm(path, { force: true });
  return true;
}

export async function acquireNativeHostUpdateLock(
  path: string,
  targetVersion: string,
  options: NativeHostUpdateLockOptions = {},
): Promise<NativeHostUpdateLockLease> {
  if (!isPanerelayReleaseVersion(targetVersion)) {
    throw new Error('The Native Host update lock requires a valid target release');
  }
  const platform = options.platform ?? process.platform;
  const now = options.now ?? Date.now;
  const isProcessAlive = options.isProcessAlive ?? nativeHostProcessAlive;
  const pollMs = Math.min(Math.max(options.pollMs ?? 100, 10), 1_000);
  const staleMs = Math.min(Math.max(options.staleMs ?? 10 * 60_000, 1_000), 60 * 60_000);
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 30_000, 100), 2 * 60_000);
  const waitStartedAt = Date.now();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });

  while (Date.now() - waitStartedAt <= timeoutMs) {
    const record: NativeHostUpdateLockRecord = {
      pid: process.pid,
      startedAt: now(),
      targetVersion,
    };
    const candidatePath = `${path}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
    let installed = false;
    try {
      const handle = await open(candidatePath, 'wx', 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      if (platform !== 'win32') await chmod(candidatePath, 0o600);
      await link(candidatePath, path);
      installed = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    } finally {
      await rm(candidatePath, { force: true });
    }
    if (installed) {
      const owned = await readNativeHostUpdateLock(path, platform);
      return {
        record,
        release: async () => {
          await removeMatchingNativeHostUpdateLock(path, owned, platform);
        },
      };
    }

    let existing: Awaited<ReturnType<typeof readNativeHostUpdateLock>>;
    try {
      existing = await readNativeHostUpdateLock(path, platform);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    if (now() - existing.record.startedAt > staleMs && !isProcessAlive(existing.record.pid)) {
      await removeMatchingNativeHostUpdateLock(path, existing, platform);
      continue;
    }
    await delay(pollMs);
  }
  throw new Error('Timed out waiting for the Native Host update lock');
}

export function nativeHostBundlePath(hostsDirectory: string, releaseVersion: string): string {
  if (!isPanerelayReleaseVersion(releaseVersion)) {
    throw new Error('A Native Host bundle path requires a valid Panerelay release');
  }
  return join(hostsDirectory, releaseVersion, NATIVE_HOST_BUNDLE_FILENAME);
}

async function verifyNativeHostBundle(
  bundlePath: string,
  expectedReleaseVersion: string,
  runner: CommandRunner,
  environment: NodeJS.ProcessEnv,
): Promise<NativeHostSelfCheck> {
  const info = await lstat(bundlePath);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error('The staged Native Host bundle is not a protected regular file');
  }
  const result = await runner(process.execPath, [bundlePath, '--self-check'], {
    environment,
    timeoutMs: 5_000,
  });
  if (result.code !== 0) throw new Error('The staged Native Host self-check failed');
  let check: unknown;
  try {
    check = JSON.parse(result.stdout);
  } catch {
    throw new Error('The staged Native Host self-check returned malformed output');
  }
  if (!check || typeof check !== 'object' || Array.isArray(check)) {
    throw new Error('The staged Native Host self-check returned malformed output');
  }
  const record = check as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(',') !== 'protocol,release' ||
    record.protocol !== PANERELAY_PROTOCOL_VERSION ||
    record.release !== expectedReleaseVersion
  ) {
    throw new Error('The staged Native Host identity does not match setup');
  }
  return {
    protocol: PANERELAY_PROTOCOL_VERSION,
    release: expectedReleaseVersion,
  };
}

async function bridgePackageReleaseVersion(): Promise<string> {
  const packageManifest = JSON.parse(
    await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as { version?: unknown };
  if (!isPanerelayReleaseVersion(packageManifest.version)) {
    throw new Error('The Bridge package has an invalid Panerelay release');
  }
  return packageManifest.version;
}

async function pruneNativeHostVersions(
  hostsDirectory: string,
  retainedVersions: readonly (string | undefined)[],
): Promise<void> {
  const retained = new Set(retainedVersions.filter((value): value is string => Boolean(value)));
  for (const entry of await readdir(hostsDirectory, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      !isPanerelayReleaseVersion(entry.name) ||
      retained.has(entry.name)
    ) {
      continue;
    }
    await rm(join(hostsDirectory, entry.name), { force: true, recursive: true });
  }
}

async function installNativeHostUnlocked(
  options: NativeHostInstallOptions = {},
): Promise<NativeHostInstallationResult> {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const paths = resolveNativeHostInstallationPaths(options);
  const stored = await persistedRuntimeConfig(paths.runtimeConfigPath);
  const extensionId = resolveEffectiveExtensionId({
    environment,
    extensionId: options.extensionId,
    persistedExtensionId: stored.extensionId,
  });
  const bundledHostPath =
    options.bundledHostPath ?? fileURLToPath(new URL('./native-host.bundle.cjs', import.meta.url));
  const bundledHost = await readFile(bundledHostPath, 'utf8');
  const releaseVersion = options.expectedReleaseVersion ?? (await bridgePackageReleaseVersion());
  if (!isPanerelayReleaseVersion(releaseVersion)) {
    throw new Error('The expected Native Host release is invalid');
  }
  const nodePath = options.nodePath ?? process.execPath;
  const nodeDirectory = platform === 'win32' ? win32.dirname(nodePath) : dirname(nodePath);
  const agentPathEntries = executablePathEntries(environment, {
    platform,
    prepend: [
      nodeDirectory,
      ...(Array.isArray(stored.agentPathEntries)
        ? stored.agentPathEntries.filter((entry): entry is string => typeof entry === 'string')
        : []),
    ],
  });
  const previousPointer = await optionalNativeHostVersionPointer(
    paths.currentVersionPath,
    platform,
  );
  const targetDirectory = join(paths.hostsDirectory, releaseVersion);
  const selectedHostPath = nativeHostBundlePath(paths.hostsDirectory, releaseVersion);
  const stagingDirectory = join(
    paths.hostsDirectory,
    `.${releaseVersion}.${process.pid}.${randomBytes(8).toString('hex')}.stage`,
  );
  const stagedHostPath = join(stagingDirectory, NATIVE_HOST_BUNDLE_FILENAME);
  await mkdir(paths.hostsDirectory, { recursive: true, mode: 0o700 });
  if (platform !== 'win32') await chmod(paths.hostsDirectory, 0o700);
  await mkdir(stagingDirectory, { recursive: false, mode: 0o700 });
  try {
    await writeFile(stagedHostPath, bundledHost, { flag: 'wx', mode: 0o755 });
    if (platform !== 'win32') await chmod(stagedHostPath, 0o755);
    await verifyNativeHostBundle(
      stagedHostPath,
      releaseVersion,
      options.selfCheckRunner ?? runCommand,
      environment,
    );
    try {
      await verifyNativeHostBundle(
        selectedHostPath,
        releaseVersion,
        options.selfCheckRunner ?? runCommand,
        environment,
      );
    } catch (error) {
      if (previousPointer?.version === releaseVersion) {
        throw new Error('The currently selected Native Host bundle failed validation', {
          cause: error,
        });
      }
      await rm(targetDirectory, { force: true, recursive: true });
      await rename(stagingDirectory, targetDirectory);
    }
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true });
  }

  await writeProtectedFile(
    paths.hostPath,
    nativeHostLauncherContent(platform === 'win32' ? '/usr/bin/env node' : nodePath),
    0o755,
  );
  await rm(paths.legacyHostPath, { force: true });
  if (paths.launcherPath) {
    await writeProtectedFile(
      paths.launcherPath,
      windowsLauncherContent(nodePath, paths.hostPath),
      0o700,
    );
  }

  const codexPath = await resolveExecutablePath('codex', {
    configuredPath:
      environment.PANERELAY_CODEX_PATH ??
      (typeof stored.codexPath === 'string' ? stored.codexPath : undefined),
    environment,
    platform,
  });
  const claudePath = await resolveExecutablePath('claude', {
    configuredPath:
      environment.PANERELAY_CLAUDE_PATH ??
      (typeof stored.claudePath === 'string' ? stored.claudePath : undefined),
    environment,
    platform,
  });
  let claudeVersion: string | undefined;
  if (claudePath) {
    try {
      claudeVersion = await probeExecutableVersion(claudePath, {
        environment,
        platform,
        runner: options.probeRunner,
      });
    } catch {
      // The executable remains usable; doctor surfaces the missing version metadata.
    }
  }
  if (
    !claudeVersion &&
    claudePath === stored.claudePath &&
    typeof stored.claudeVersion === 'string'
  ) {
    claudeVersion = stored.claudeVersion;
  }
  const qoder = await resolveQoderExecutable({
    configuredPath:
      environment.PANERELAY_QODER_PATH ??
      (typeof stored.qoderPath === 'string' ? stored.qoderPath : undefined),
    environment,
    homeDirectory: options.homeDirectory,
    platform,
    processExecPath: options.nodePath ?? process.execPath,
    runner: options.probeRunner,
  });
  const opencode = await resolveOpenCodeExecutable({
    configuredPath:
      environment.PANERELAY_OPENCODE_PATH ??
      (typeof stored.opencodePath === 'string' ? stored.opencodePath : undefined),
    environment,
    homeDirectory: options.homeDirectory,
    platform,
    processExecPath: options.nodePath ?? process.execPath,
    runner: options.probeRunner,
  });
  await writeProtectedFile(
    paths.runtimeConfigPath,
    `${JSON.stringify(
      {
        extensionId,
        agentPathEntries,
        ...(codexPath ? { codexPath } : {}),
        ...(claudePath ? { claudePath } : {}),
        ...(claudeVersion ? { claudeVersion } : {}),
        ...(qoder.executable ? { qoderPath: qoder.executable } : {}),
        ...(qoder.version ? { qoderVersion: qoder.version } : {}),
        ...(opencode.executable ? { opencodePath: opencode.executable } : {}),
        ...(opencode.version ? { opencodeVersion: opencode.version } : {}),
      },
      null,
      2,
    )}\n`,
    0o600,
  );
  const manifest = `${JSON.stringify(
    {
      name: PANERELAY_NATIVE_HOST_NAME,
      description: 'Panerelay local browser and agent bridge',
      path: paths.launchPath,
      type: 'stdio',
      allowed_origins: [`chrome-extension://${extensionId}/`],
    },
    null,
    2,
  )}\n`;
  for (const manifestPath of paths.manifestPaths) {
    await writeProtectedFile(manifestPath, manifest, 0o644);
  }
  if (platform === 'win32') {
    await Promise.all(
      (['chrome', 'edge'] as const).map(browser =>
        registerWindowsNativeHost(paths.manifestPaths[0]!, {
          browser,
          environment,
          runner: options.registryRunner,
        }),
      ),
    );
  }

  await writeProtectedFile(
    paths.currentVersionPath,
    `${JSON.stringify({ version: releaseVersion }, null, 2)}\n`,
    0o600,
  );
  await pruneNativeHostVersions(paths.hostsDirectory, [releaseVersion, previousPointer?.version]);

  return {
    ...paths,
    extensionId,
    releaseVersion,
    selectedHostPath,
    ...(codexPath ? { codexPath } : {}),
    ...(claudePath ? { claudePath } : {}),
    ...(claudeVersion ? { claudeVersion } : {}),
    ...(qoder.executable ? { qoderPath: qoder.executable } : {}),
    ...(qoder.version ? { qoderVersion: qoder.version } : {}),
    ...(opencode.executable ? { opencodePath: opencode.executable } : {}),
    ...(opencode.version ? { opencodeVersion: opencode.version } : {}),
  };
}

export async function installNativeHost(
  options: NativeHostInstallOptions = {},
): Promise<NativeHostInstallationResult> {
  const releaseVersion = options.expectedReleaseVersion ?? (await bridgePackageReleaseVersion());
  if (!isPanerelayReleaseVersion(releaseVersion)) {
    throw new Error('The expected Native Host release is invalid');
  }
  const paths = resolveNativeHostInstallationPaths(options);
  const lease = await acquireNativeHostUpdateLock(paths.updateLockPath, releaseVersion, {
    ...(options.isProcessAlive ? { isProcessAlive: options.isProcessAlive } : {}),
    ...(options.lockPollMs === undefined ? {} : { pollMs: options.lockPollMs }),
    ...(options.lockStaleMs === undefined ? {} : { staleMs: options.lockStaleMs }),
    ...(options.lockTimeoutMs === undefined ? {} : { timeoutMs: options.lockTimeoutMs }),
    ...(options.platform ? { platform: options.platform } : {}),
  });
  try {
    return await installNativeHostUnlocked({ ...options, expectedReleaseVersion: releaseVersion });
  } finally {
    await lease.release();
  }
}

export async function uninstallNativeHost(
  options: NativeHostUninstallOptions = {},
): Promise<NativeHostInstallationPaths> {
  const platform = options.platform ?? process.platform;
  const paths = resolveNativeHostInstallationPaths(options);
  if (platform === 'win32') {
    await Promise.all(
      (['chrome', 'edge'] as const).map(browser =>
        unregisterWindowsNativeHost({
          browser,
          environment: options.environment,
          runner: options.registryRunner,
        }),
      ),
    );
  }
  await Promise.all(paths.manifestPaths.map(manifestPath => rm(manifestPath, { force: true })));
  await Promise.all([
    rm(paths.hostPath, { force: true }),
    ...(paths.launcherPath ? [rm(paths.launcherPath, { force: true })] : []),
    rm(paths.legacyHostPath, { force: true }),
    rm(paths.runtimeConfigPath, { force: true }),
    rm(paths.currentVersionPath, { force: true }),
    rm(paths.updateLockPath, { force: true }),
    rm(paths.hostsDirectory, { force: true, recursive: true }),
  ]);
  return paths;
}
