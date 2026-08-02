import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PANERELAY_EXTENSION_ID, PANERELAY_NATIVE_HOST_NAME } from '@panerelay/protocol';
import {
  probeExecutableVersion,
  resolveExecutablePath,
  runCommand,
  type CommandRunner,
} from './platform.js';
import { resolveQoderExecutable } from './qoder-executable.js';

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
  extensionId?: string;
  nodePath?: string;
  probeRunner?: CommandRunner;
  registryRunner?: CommandRunner;
}

export interface NativeHostUninstallOptions extends NativeHostPathOptions {
  environment?: NodeJS.ProcessEnv;
  registryRunner?: CommandRunner;
}

export interface NativeHostInstallationPaths {
  hostPath: string;
  launchPath: string;
  launcherPath?: string;
  legacyHostPath: string;
  manifestPaths: string[];
  runtimeConfigPath: string;
}

export interface NativeHostInstallationResult extends NativeHostInstallationPaths {
  codexPath?: string;
  claudePath?: string;
  claudeVersion?: string;
  extensionId: string;
  qoderPath?: string;
  qoderVersion?: string;
}

interface StoredRuntimeConfig {
  extensionId?: unknown;
}

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

export function resolveNativeHostInstallationPaths(
  options: NativeHostPathOptions = {},
): NativeHostInstallationPaths {
  const home = options.homeDirectory ?? homedir();
  const dataDirectory = options.dataDirectory ?? join(home, '.panerelay');
  const hostDirectory = join(dataDirectory, 'bin');
  const hostPath = join(hostDirectory, 'panerelay-native-host.cjs');
  const platform = options.platform ?? process.platform;
  const launcherPath =
    platform === 'win32' ? join(hostDirectory, 'panerelay-native-host.cmd') : undefined;
  return {
    hostPath,
    launchPath: launcherPath ?? hostPath,
    ...(launcherPath ? { launcherPath } : {}),
    legacyHostPath: join(hostDirectory, 'panerelay-native-host.mjs'),
    manifestPaths: nativeHostManifestPaths({ ...options, dataDirectory }),
    runtimeConfigPath: join(dataDirectory, 'runtime.json'),
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

export async function installNativeHost(
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
  const installedHost =
    platform === 'win32'
      ? bundledHost
      : bundledHost.replace(/^#![^\n]*/, `#!${options.nodePath ?? process.execPath}`);

  await mkdir(dirname(paths.hostPath), { recursive: true, mode: 0o700 });
  await writeFile(paths.hostPath, installedHost, { mode: 0o755 });
  if (platform !== 'win32') await chmod(paths.hostPath, 0o755);
  await rm(paths.legacyHostPath, { force: true });
  if (paths.launcherPath) {
    await writeFile(
      paths.launcherPath,
      windowsLauncherContent(options.nodePath ?? process.execPath, paths.hostPath),
      { mode: 0o700 },
    );
  }

  const codexPath = await resolveExecutablePath('codex', {
    configuredPath: environment.PANERELAY_CODEX_PATH,
    environment,
    platform,
  });
  const claudePath = await resolveExecutablePath('claude', {
    configuredPath: environment.PANERELAY_CLAUDE_PATH,
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
  const qoder = await resolveQoderExecutable({
    configuredPath: environment.PANERELAY_QODER_PATH,
    environment,
    homeDirectory: options.homeDirectory,
    platform,
    processExecPath: options.nodePath ?? process.execPath,
    runner: options.probeRunner,
  });
  await writeFile(
    paths.runtimeConfigPath,
    `${JSON.stringify(
      {
        extensionId,
        ...(codexPath ? { codexPath } : {}),
        ...(claudePath ? { claudePath } : {}),
        ...(claudeVersion ? { claudeVersion } : {}),
        ...(qoder.executable ? { qoderPath: qoder.executable } : {}),
        ...(qoder.version ? { qoderVersion: qoder.version } : {}),
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  if (platform !== 'win32') await chmod(paths.runtimeConfigPath, 0o600);
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
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, manifest, { mode: 0o644 });
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

  return {
    ...paths,
    extensionId,
    ...(codexPath ? { codexPath } : {}),
    ...(claudePath ? { claudePath } : {}),
    ...(claudeVersion ? { claudeVersion } : {}),
    ...(qoder.executable ? { qoderPath: qoder.executable } : {}),
    ...(qoder.version ? { qoderVersion: qoder.version } : {}),
  };
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
  ]);
  return paths;
}
