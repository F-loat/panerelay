import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PANERELAY_EXTENSION_ID,
  PANERELAY_FIREFOX_EXTENSION_ID,
  PANERELAY_NATIVE_HOST_NAME,
} from '@panerelay/protocol';
import { resolveExecutablePath, runCommand, type CommandRunner } from './platform.js';
import { resolveQoderExecutable } from './qoder-executable.js';
import { probeAgentBrowserCompatibility } from './compatibility.js';
import {
  createFirefoxManagedToken,
  discoverFirefoxAutomation,
  firefoxLauncherContent,
} from './firefox-automation.js';

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
  firefoxExtensionId?: string;
  firefoxPath?: string;
  firefoxProfile?: string;
  geckodriverPath?: string;
  marionettePort?: number;
  nodePath?: string;
  probeRunner?: CommandRunner;
  registryRunner?: CommandRunner;
}

export interface NativeHostUninstallOptions extends NativeHostPathOptions {
  environment?: NodeJS.ProcessEnv;
  registryRunner?: CommandRunner;
}

export interface NativeHostInstallationPaths {
  agentBrowserConfigPath: string;
  hostPath: string;
  launchPath: string;
  launcherPath?: string;
  legacyHostPath: string;
  legacyManifestPaths: string[];
  chromiumManifestPaths: string[];
  firefoxManifestPaths: string[];
  firefoxLauncherPath: string;
  firefoxRuntimeStatePath: string;
  manifestPaths: string[];
  runtimeConfigPath: string;
}

export interface NativeHostInstallationResult extends NativeHostInstallationPaths {
  agentBrowserPath?: string;
  agentBrowserSupported: boolean;
  agentBrowserVersion?: string;
  codexPath?: string;
  extensionId: string;
  firefoxExtensionId: string;
  firefoxPath?: string;
  firefoxVersion?: string;
  firefoxProfile?: string;
  geckodriverPath?: string;
  geckodriverVersion?: string;
  firefoxAutomationReady: boolean;
  qoderPath?: string;
  qoderVersion?: string;
}

interface StoredRuntimeConfig {
  extensionId?: unknown;
  firefoxExtensionId?: unknown;
  firefoxManagedToken?: unknown;
}

export type WindowsNativeMessagingBrowser = 'chrome' | 'edge' | 'firefox';

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

export function validateFirefoxExtensionId(value: string): string {
  const emailId = /^[A-Za-z0-9._-]*@[A-Za-z0-9._-]+$/.test(value);
  const guidId =
    /^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$/.test(value);
  if ((!emailId || value.length > 80) && !guidId) {
    throw new Error(
      'Firefox Extension ID must be an email-style ID of at most 80 characters or a braced UUID.',
    );
  }
  return value;
}

export function resolveEffectiveFirefoxExtensionId(options: {
  environment?: NodeJS.ProcessEnv;
  firefoxExtensionId?: string;
  persistedFirefoxExtensionId?: unknown;
}): string {
  const environment = options.environment ?? process.env;
  const value =
    options.firefoxExtensionId ??
    environment.PANERELAY_FIREFOX_EXTENSION_ID ??
    (typeof options.persistedFirefoxExtensionId === 'string'
      ? options.persistedFirefoxExtensionId
      : PANERELAY_FIREFOX_EXTENSION_ID);
  return validateFirefoxExtensionId(value);
}

export function windowsNativeHostRegistryKey(
  hostName = PANERELAY_NATIVE_HOST_NAME,
  browser: WindowsNativeMessagingBrowser = 'chrome',
): string {
  const owner =
    browser === 'edge' ? 'Microsoft\\Edge' : browser === 'firefox' ? 'Mozilla' : 'Google\\Chrome';
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
  const firefoxLauncherPath = join(
    hostDirectory,
    platform === 'win32' ? 'panerelay-firefox.cmd' : 'panerelay-firefox',
  );
  const chromiumManifestPaths = chromiumNativeHostManifestPaths({ ...options, dataDirectory });
  const firefoxManifestPaths = firefoxNativeHostManifestPaths({ ...options, dataDirectory });
  const legacyManifestPaths =
    platform === 'win32'
      ? [join(dataDirectory, 'native-messaging', `${PANERELAY_NATIVE_HOST_NAME}.json`)]
      : [];
  return {
    agentBrowserConfigPath: join(dataDirectory, 'agent-browser.json'),
    hostPath,
    launchPath: launcherPath ?? hostPath,
    ...(launcherPath ? { launcherPath } : {}),
    legacyHostPath: join(hostDirectory, 'panerelay-native-host.mjs'),
    legacyManifestPaths,
    chromiumManifestPaths,
    firefoxManifestPaths,
    firefoxLauncherPath,
    firefoxRuntimeStatePath: join(dataDirectory, 'firefox-runtime.json'),
    manifestPaths: [...chromiumManifestPaths, ...firefoxManifestPaths],
    runtimeConfigPath: join(dataDirectory, 'runtime.json'),
  };
}

export function nativeHostManifestPaths(options: NativeHostPathOptions = {}): string[] {
  return [...chromiumNativeHostManifestPaths(options), ...firefoxNativeHostManifestPaths(options)];
}

export function chromiumNativeHostManifestPaths(options: NativeHostPathOptions = {}): string[] {
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
      return [join(dataDirectory, 'native-messaging', 'chromium', filename)];
    default:
      throw new Error(
        `Native Messaging installation is not implemented for ${options.platform ?? process.platform}`,
      );
  }
}

export function firefoxNativeHostManifestPaths(options: NativeHostPathOptions = {}): string[] {
  const home = options.homeDirectory ?? homedir();
  const filename = `${PANERELAY_NATIVE_HOST_NAME}.json`;
  const dataDirectory = options.dataDirectory ?? join(home, '.panerelay');
  switch (options.platform ?? process.platform) {
    case 'darwin':
      return [
        join(home, 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts', filename),
      ];
    case 'linux':
      return [join(home, '.mozilla', 'native-messaging-hosts', filename)];
    case 'win32':
      return [join(dataDirectory, 'native-messaging', 'firefox', filename)];
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
  const firefoxExtensionId = resolveEffectiveFirefoxExtensionId({
    environment,
    firefoxExtensionId: options.firefoxExtensionId,
    persistedFirefoxExtensionId: stored.firefoxExtensionId,
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

  const firefox = await discoverFirefoxAutomation({
    environment,
    firefoxPath: options.firefoxPath,
    firefoxProfile: options.firefoxProfile,
    geckodriverPath: options.geckodriverPath,
    marionettePort: options.marionettePort,
    platform,
    probeRunner: options.probeRunner,
  });
  const firefoxManagedToken =
    typeof stored.firefoxManagedToken === 'string' && stored.firefoxManagedToken.length >= 32
      ? stored.firefoxManagedToken
      : createFirefoxManagedToken();
  const firefoxAutomationReady = Boolean(firefox.firefoxPath && firefox.geckodriverPath);
  if (firefoxAutomationReady) {
    await writeFile(paths.firefoxLauncherPath, firefoxLauncherContent(paths.launchPath, platform), {
      mode: 0o700,
    });
    if (platform !== 'win32') await chmod(paths.firefoxLauncherPath, 0o700);
  } else {
    await rm(paths.firefoxLauncherPath, { force: true });
  }

  const codexPath = await resolveExecutablePath('codex', {
    configuredPath: environment.PANERELAY_CODEX_PATH,
    environment,
    platform,
  });
  const agentBrowserPath = await resolveExecutablePath('agent-browser', {
    configuredPath: environment.PANERELAY_AGENT_BROWSER_PATH,
    environment,
    platform,
  });
  let agentBrowserVersion: string | undefined;
  let agentBrowserSupported = false;
  if (agentBrowserPath) {
    try {
      const compatibility = await probeAgentBrowserCompatibility(agentBrowserPath, {
        environment,
        platform,
        runner: options.probeRunner,
      });
      agentBrowserVersion = compatibility.version;
      agentBrowserSupported = compatibility.supported;
    } catch {
      // Doctor reports the failed bounded version probe with upgrade guidance.
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
        firefoxExtensionId,
        ...(firefox.firefoxPath ? { firefoxPath: firefox.firefoxPath } : {}),
        ...(firefox.firefoxVersion ? { firefoxVersion: firefox.firefoxVersion } : {}),
        ...(firefox.firefoxProfile ? { firefoxProfile: firefox.firefoxProfile } : {}),
        ...(firefox.geckodriverPath ? { geckodriverPath: firefox.geckodriverPath } : {}),
        ...(firefox.geckodriverVersion ? { geckodriverVersion: firefox.geckodriverVersion } : {}),
        firefoxManagedToken,
        firefoxMarionettePort: firefox.marionettePort,
        firefoxRuntimeStatePath: paths.firefoxRuntimeStatePath,
        firefoxLauncherPath: paths.firefoxLauncherPath,
        ...(codexPath ? { codexPath } : {}),
        ...(agentBrowserPath ? { agentBrowserPath } : {}),
        ...(agentBrowserVersion ? { agentBrowserVersion } : {}),
        ...(qoder.executable ? { qoderPath: qoder.executable } : {}),
        ...(qoder.version ? { qoderVersion: qoder.version } : {}),
        agentBrowserConfigPath: paths.agentBrowserConfigPath,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  if (platform !== 'win32') await chmod(paths.runtimeConfigPath, 0o600);
  await writeFile(
    paths.agentBrowserConfigPath,
    `${JSON.stringify(
      {
        plugins: [
          {
            name: 'panerelay',
            command: paths.launchPath,
            args: ['--agent-browser-plugin'],
            capabilities: ['browser.provider'],
          },
        ],
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  if (platform !== 'win32') await chmod(paths.agentBrowserConfigPath, 0o600);

  const chromiumManifest = `${JSON.stringify(
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
  const firefoxManifest = `${JSON.stringify(
    {
      name: PANERELAY_NATIVE_HOST_NAME,
      description: 'Panerelay local browser and agent bridge',
      path: paths.launchPath,
      type: 'stdio',
      allowed_extensions: [firefoxExtensionId],
    },
    null,
    2,
  )}\n`;
  for (const manifestPath of paths.chromiumManifestPaths) {
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, chromiumManifest, { mode: 0o644 });
  }
  for (const manifestPath of paths.firefoxManifestPaths) {
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, firefoxManifest, { mode: 0o644 });
  }
  await Promise.all(
    paths.legacyManifestPaths.map(manifestPath => rm(manifestPath, { force: true })),
  );
  if (platform === 'win32') {
    await Promise.all([
      registerWindowsNativeHost(paths.chromiumManifestPaths[0]!, {
        browser: 'chrome',
        environment,
        runner: options.registryRunner,
      }),
      registerWindowsNativeHost(paths.chromiumManifestPaths[0]!, {
        browser: 'edge',
        environment,
        runner: options.registryRunner,
      }),
      registerWindowsNativeHost(paths.firefoxManifestPaths[0]!, {
        browser: 'firefox',
        environment,
        runner: options.registryRunner,
      }),
    ]);
  }

  return {
    ...paths,
    extensionId,
    firefoxExtensionId,
    ...(firefox.firefoxPath ? { firefoxPath: firefox.firefoxPath } : {}),
    ...(firefox.firefoxVersion ? { firefoxVersion: firefox.firefoxVersion } : {}),
    ...(firefox.firefoxProfile ? { firefoxProfile: firefox.firefoxProfile } : {}),
    ...(firefox.geckodriverPath ? { geckodriverPath: firefox.geckodriverPath } : {}),
    ...(firefox.geckodriverVersion ? { geckodriverVersion: firefox.geckodriverVersion } : {}),
    firefoxAutomationReady,
    ...(codexPath ? { codexPath } : {}),
    ...(agentBrowserPath ? { agentBrowserPath } : {}),
    agentBrowserSupported,
    ...(agentBrowserVersion ? { agentBrowserVersion } : {}),
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
      (['chrome', 'edge', 'firefox'] as const).map(browser =>
        unregisterWindowsNativeHost({
          browser,
          environment: options.environment,
          runner: options.registryRunner,
        }),
      ),
    );
  }
  await Promise.all(
    [...paths.manifestPaths, ...paths.legacyManifestPaths].map(manifestPath =>
      rm(manifestPath, { force: true }),
    ),
  );
  await Promise.all([
    rm(paths.hostPath, { force: true }),
    ...(paths.launcherPath ? [rm(paths.launcherPath, { force: true })] : []),
    rm(paths.firefoxLauncherPath, { force: true }),
    rm(paths.firefoxRuntimeStatePath, { force: true }),
    rm(paths.legacyHostPath, { force: true }),
    rm(paths.runtimeConfigPath, { force: true }),
    rm(paths.agentBrowserConfigPath, { force: true }),
  ]);
  return paths;
}
