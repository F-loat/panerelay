import { randomBytes } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  browserUseAdapterManifest,
  SUPPORTED_BROWSER_HARNESS_VERSION,
  SUPPORTED_BROWSER_USE_VERSION,
  type BrowserUseVersions,
} from '@panerelay/browser-use';
import {
  readCliAdapterMode,
  readCliAdapterRegistration,
  removeCliAdapterMode,
  removeCliAdapterRegistration,
  registerCliAdapter,
  setCliAdapterMode,
  type CliAdapterRegistration,
  type CliAdapterRegistry,
} from '@panerelay/cli';

export const PANERELAY_BROWSER_USE_INTEGRATION_VERSION = '0.2.0' as const;
export const PANERELAY_BROWSER_USE_CONFIG_PROTOCOL =
  'panerelay.browser-use-integration.v1' as const;

export interface BrowserUseIntegrationPathOptions {
  dataDirectory?: string;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
}

export interface BrowserUseIntegrationPaths {
  adapterArtifactPath: string;
  adapterLauncherPath: string;
  adapterPackagePath: string;
  adapterStorageDirectory: string;
  browserUseDirectory: string;
  cliArtifactPath: string;
  cliLauncherPath: string;
  cliStorageDirectory: string;
  dataDirectory: string;
  integrationConfigPath: string;
  mcpLauncherPath: string;
  mcpRunnerArtifactPath: string;
  runtimeDirectory: string;
}

export interface InstallBrowserUseIntegrationOptions extends BrowserUseIntegrationPathOptions {
  adapterBundlePath?: string;
  browserUseVersions?: BrowserUseVersions;
  cliBundlePath?: string;
  nodePath?: string;
  readAdapterMode?: typeof readCliAdapterMode;
  registerAdapter?: typeof registerCliAdapter;
  removeAdapter?: typeof removeCliAdapterRegistration;
  setAdapterMode?: typeof setCliAdapterMode;
}

export interface BrowserUseIntegrationConfig {
  adapterId: 'browser-use';
  adapterLauncherPath: string;
  cliLauncherPath: string;
  mcpLauncherPath?: string;
  browserHarnessVersion?: string;
  browserUseExecutable?: string;
  browserUseVersion?: string;
  protocol: typeof PANERELAY_BROWSER_USE_CONFIG_PROTOCOL;
  runtimeDirectory: string;
  runtimeName: 'panerelay';
  version: typeof PANERELAY_BROWSER_USE_INTEGRATION_VERSION;
}

export interface BrowserUseIntegrationInstallation {
  config: BrowserUseIntegrationConfig;
  paths: BrowserUseIntegrationPaths;
  registration: CliAdapterRegistration;
  registry: CliAdapterRegistry;
}

export interface UninstallBrowserUseIntegrationOptions extends BrowserUseIntegrationPathOptions {
  removeAdapter?: typeof removeCliAdapterRegistration;
  removeAdapterMode?: typeof removeCliAdapterMode;
}

export interface BrowserUseIntegrationUninstallResult {
  detachedDaemonMayRemain: boolean;
  paths: BrowserUseIntegrationPaths;
  registry: CliAdapterRegistry;
  runtimeStateRemoved: boolean;
}

function pathImplementation(platform: NodeJS.Platform): typeof path.posix | typeof path.win32 {
  return platform === 'win32' ? path.win32 : path.posix;
}

export function resolveBrowserUseIntegrationPaths(
  options: BrowserUseIntegrationPathOptions = {},
): BrowserUseIntegrationPaths {
  const platform = options.platform ?? process.platform;
  const paths = pathImplementation(platform);
  const dataDirectory =
    options.dataDirectory ?? paths.join(options.homeDirectory ?? homedir(), '.panerelay');
  const cliVersionDirectory = paths.join(
    dataDirectory,
    'cli',
    'browser-use',
    PANERELAY_BROWSER_USE_INTEGRATION_VERSION,
  );
  const adapterStorageDirectory = paths.join(dataDirectory, 'adapters', 'browser-use');
  const cliStorageDirectory = paths.join(dataDirectory, 'cli', 'browser-use');
  const browserUseDirectory = paths.join(dataDirectory, 'browser-use');
  const adapterVersionDirectory = paths.join(
    adapterStorageDirectory,
    PANERELAY_BROWSER_USE_INTEGRATION_VERSION,
  );
  const launcherExtension = platform === 'win32' ? '.cmd' : '';
  return {
    adapterArtifactPath: paths.join(
      adapterVersionDirectory,
      'dist',
      'panerelay-browser-use-adapter.mjs',
    ),
    adapterLauncherPath: paths.join(
      dataDirectory,
      'bin',
      `panerelay-browser-use-adapter${launcherExtension}`,
    ),
    adapterPackagePath: paths.join(adapterVersionDirectory, 'package.json'),
    adapterStorageDirectory,
    browserUseDirectory,
    cliArtifactPath: paths.join(cliVersionDirectory, 'dist', 'panerelay-cli.mjs'),
    cliLauncherPath: paths.join(
      dataDirectory,
      'bin',
      `panerelay-browser-use-cli${launcherExtension}`,
    ),
    cliStorageDirectory,
    dataDirectory,
    integrationConfigPath: paths.join(browserUseDirectory, 'config.json'),
    mcpLauncherPath: paths.join(
      dataDirectory,
      'bin',
      `panerelay-browser-use-mcp${launcherExtension}`,
    ),
    mcpRunnerArtifactPath: paths.join(
      cliVersionDirectory,
      'dist',
      'panerelay-browser-use-mcp-runner.mjs',
    ),
    runtimeDirectory: paths.join(browserUseDirectory, 'runtime'),
  };
}

function bundledPrivatePath(fileName: string): string {
  return fileURLToPath(new URL(`./private/browser-use/${fileName}`, import.meta.url));
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function posixNodeLauncherContent(nodePath: string, scriptPath: string): string {
  return `#!/bin/sh\nexec ${shellQuote(nodePath)} ${shellQuote(scriptPath)} "$@"\n`;
}

export function windowsNodeLauncherContent(nodePath: string, scriptPath: string): string {
  const escapePercent = (value: string): string => value.replaceAll('%', '%%');
  return [
    '@echo off',
    'setlocal DisableDelayedExpansion',
    `"${escapePercent(nodePath)}" "${escapePercent(scriptPath)}" %*`,
    '',
  ].join('\r\n');
}

export function browserUseMcpLauncherContent(
  nodePath: string,
  cliArtifactPath: string,
  mcpRunnerArtifactPath: string,
  browserUseExecutable: string,
  platform: NodeJS.Platform,
): string {
  if (platform === 'win32') {
    const escapePercent = (value: string): string => value.replaceAll('%', '%%');
    return [
      '@echo off',
      'setlocal DisableDelayedExpansion',
      `"${escapePercent(nodePath)}" "${escapePercent(cliArtifactPath)}" run browser-use -- "${escapePercent(nodePath)}" "${escapePercent(mcpRunnerArtifactPath)}" "${escapePercent(browserUseExecutable)}"`,
      '',
    ].join('\r\n');
  }
  return `#!/bin/sh\nexec ${shellQuote(nodePath)} ${shellQuote(cliArtifactPath)} run browser-use -- ${shellQuote(nodePath)} ${shellQuote(mcpRunnerArtifactPath)} ${shellQuote(browserUseExecutable)}\n`;
}

async function ensureProtectedDirectory(
  directory: string,
  platform: NodeJS.Platform,
): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Panerelay private path is not a regular directory: ${directory}`);
  }
  if (platform !== 'win32') await chmod(directory, 0o700);
}

async function existingRegularFile(filePath: string): Promise<Buffer | null> {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`Panerelay private path is not a regular file: ${filePath}`);
    }
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function writeProtectedFile(
  filePath: string,
  content: Buffer | string,
  mode: number,
  platform: NodeJS.Platform,
): Promise<void> {
  await ensureProtectedDirectory(pathImplementation(platform).dirname(filePath), platform);
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const existing = await existingRegularFile(filePath);
  if (existing?.equals(bytes)) {
    if (platform !== 'win32') await chmod(filePath, mode);
    return;
  }
  const suffix = `${process.pid}.${randomBytes(6).toString('hex')}`;
  const temporaryPath = `${filePath}.${suffix}.tmp`;
  const backupPath = `${filePath}.${suffix}.bak`;
  await writeFile(temporaryPath, bytes, { mode });
  let backedUp = false;
  try {
    if (platform === 'win32' && existing) {
      await rename(filePath, backupPath);
      backedUp = true;
    }
    await rename(temporaryPath, filePath);
    if (platform !== 'win32') await chmod(filePath, mode);
    if (backedUp) await rm(backupPath, { force: true });
  } catch (error) {
    await rm(temporaryPath, { force: true });
    if (backedUp) {
      await rm(filePath, { force: true });
      await rename(backupPath, filePath);
    }
    throw error;
  }
}

interface ProtectedFileSnapshot {
  content: Buffer;
  mode: number;
}

async function snapshotProtectedFile(filePath: string): Promise<ProtectedFileSnapshot | null> {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`Panerelay private path is not a regular file: ${filePath}`);
    }
    return { content: await readFile(filePath), mode: metadata.mode & 0o777 };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function restoreProtectedFiles(
  snapshots: Map<string, ProtectedFileSnapshot | null>,
  platform: NodeJS.Platform,
): Promise<void> {
  for (const [filePath, snapshot] of snapshots) {
    if (snapshot) {
      await writeProtectedFile(filePath, snapshot.content, snapshot.mode, platform);
    } else {
      await rm(filePath, { force: true });
    }
  }
}

function adapterRegistration(executablePath: string): CliAdapterRegistration {
  const manifest = browserUseAdapterManifest(PANERELAY_BROWSER_USE_INTEGRATION_VERSION);
  return {
    adapterId: manifest.adapterId,
    version: manifest.version,
    executablePath,
    protocol: manifest.protocol,
    capabilities: manifest.capabilities,
    modes: manifest.modes,
    childEnvironmentKeys: manifest.childEnvironmentKeys,
  };
}

export async function installBrowserUseIntegrationArtifacts(
  options: InstallBrowserUseIntegrationOptions = {},
): Promise<BrowserUseIntegrationInstallation> {
  const platform = options.platform ?? process.platform;
  const paths = resolveBrowserUseIntegrationPaths(options);
  const [cliBundle, adapterBundle, mcpRunnerBundle] = await Promise.all([
    readFile(options.cliBundlePath ?? bundledPrivatePath('panerelay-cli.mjs')),
    readFile(options.adapterBundlePath ?? bundledPrivatePath('panerelay-browser-use-adapter.mjs')),
    readFile(bundledPrivatePath('panerelay-browser-use-mcp-runner.mjs')),
  ]);
  const nodePath = options.nodePath ?? process.execPath;
  const launcher = (scriptPath: string): string =>
    platform === 'win32'
      ? windowsNodeLauncherContent(nodePath, scriptPath)
      : posixNodeLauncherContent(nodePath, scriptPath);

  const registryOptions = {
    dataDirectory: paths.dataDirectory,
    homeDirectory: options.homeDirectory,
    platform,
  };
  const preferenceOptions = { homeDirectory: options.homeDirectory };
  const previousRegistration = await readCliAdapterRegistration('browser-use', registryOptions);
  const currentMode = await (options.readAdapterMode ?? readCliAdapterMode)(
    'browser-use',
    preferenceOptions,
  );
  const managedFiles = [
    paths.cliArtifactPath,
    paths.adapterArtifactPath,
    paths.mcpRunnerArtifactPath,
    paths.adapterPackagePath,
    paths.cliLauncherPath,
    paths.adapterLauncherPath,
    paths.mcpLauncherPath,
    paths.integrationConfigPath,
  ];
  const snapshots = new Map(
    await Promise.all(
      managedFiles.map(
        async filePath => [filePath, await snapshotProtectedFile(filePath)] as const,
      ),
    ),
  );
  let registrationCompleted = false;

  try {
    await ensureProtectedDirectory(paths.dataDirectory, platform);
    await Promise.all([
      writeProtectedFile(paths.cliArtifactPath, cliBundle, 0o600, platform),
      writeProtectedFile(paths.adapterArtifactPath, adapterBundle, 0o600, platform),
      writeProtectedFile(paths.mcpRunnerArtifactPath, mcpRunnerBundle, 0o600, platform),
      writeProtectedFile(
        paths.adapterPackagePath,
        `${JSON.stringify(
          {
            name: '@panerelay/browser-use-private',
            version: PANERELAY_BROWSER_USE_INTEGRATION_VERSION,
            private: true,
            type: 'module',
          },
          null,
          2,
        )}\n`,
        0o600,
        platform,
      ),
    ]);
    const browserUseCompatible =
      options.browserUseVersions?.browserUse === SUPPORTED_BROWSER_USE_VERSION &&
      options.browserUseVersions.browserHarness === SUPPORTED_BROWSER_HARNESS_VERSION &&
      Boolean(options.browserUseVersions.browserUseExecutable);
    if (browserUseCompatible) {
      await writeProtectedFile(
        paths.mcpLauncherPath,
        browserUseMcpLauncherContent(
          nodePath,
          paths.cliArtifactPath,
          paths.mcpRunnerArtifactPath,
          options.browserUseVersions!.browserUseExecutable!,
          platform,
        ),
        0o700,
        platform,
      );
    } else {
      await rm(paths.mcpLauncherPath, { force: true });
    }
    await Promise.all([
      writeProtectedFile(paths.cliLauncherPath, launcher(paths.cliArtifactPath), 0o700, platform),
      writeProtectedFile(
        paths.adapterLauncherPath,
        launcher(paths.adapterArtifactPath),
        0o700,
        platform,
      ),
    ]);

    const registration = adapterRegistration(paths.adapterLauncherPath);
    const registry = await (options.registerAdapter ?? registerCliAdapter)(
      registration,
      registryOptions,
    );
    registrationCompleted = true;
    const config: BrowserUseIntegrationConfig = {
      adapterId: 'browser-use',
      adapterLauncherPath: paths.adapterLauncherPath,
      cliLauncherPath: paths.cliLauncherPath,
      protocol: PANERELAY_BROWSER_USE_CONFIG_PROTOCOL,
      runtimeDirectory: paths.runtimeDirectory,
      runtimeName: 'panerelay',
      version: PANERELAY_BROWSER_USE_INTEGRATION_VERSION,
      ...(browserUseCompatible ? { mcpLauncherPath: paths.mcpLauncherPath } : {}),
      ...(options.browserUseVersions?.browserUseExecutable
        ? { browserUseExecutable: options.browserUseVersions.browserUseExecutable }
        : {}),
      ...(options.browserUseVersions?.browserUse
        ? { browserUseVersion: options.browserUseVersions.browserUse }
        : {}),
      ...(options.browserUseVersions?.browserHarness
        ? { browserHarnessVersion: options.browserUseVersions.browserHarness }
        : {}),
    };
    await writeProtectedFile(
      paths.integrationConfigPath,
      `${JSON.stringify(config, null, 2)}\n`,
      0o600,
      platform,
    );
    if (currentMode === null) {
      await (options.setAdapterMode ?? setCliAdapterMode)(
        'browser-use',
        'extension',
        preferenceOptions,
      );
    }
    return { config, paths, registration, registry };
  } catch (error) {
    try {
      await restoreProtectedFiles(snapshots, platform);
      if (registrationCompleted) {
        if (previousRegistration) {
          await (options.registerAdapter ?? registerCliAdapter)(
            previousRegistration,
            registryOptions,
          );
        } else {
          await (options.removeAdapter ?? removeCliAdapterRegistration)(
            'browser-use',
            registryOptions,
          );
        }
      }
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'Panerelay Browser Use installation failed and rollback was incomplete',
        { cause: rollbackError },
      );
    }
    throw error;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function uninstallBrowserUseIntegrationArtifacts(
  options: UninstallBrowserUseIntegrationOptions = {},
): Promise<BrowserUseIntegrationUninstallResult> {
  const platform = options.platform ?? process.platform;
  const paths = resolveBrowserUseIntegrationPaths(options);
  const runtimeStateRemoved = await pathExists(paths.runtimeDirectory);
  const registry = await (options.removeAdapter ?? removeCliAdapterRegistration)('browser-use', {
    dataDirectory: paths.dataDirectory,
    homeDirectory: options.homeDirectory,
    platform,
  });
  await (options.removeAdapterMode ?? removeCliAdapterMode)('browser-use', {
    homeDirectory: options.homeDirectory,
  });
  await Promise.all([
    rm(paths.adapterLauncherPath, { force: true }),
    rm(paths.cliLauncherPath, { force: true }),
    rm(paths.mcpLauncherPath, { force: true }),
    rm(paths.adapterStorageDirectory, { force: true, recursive: true }),
    rm(paths.cliStorageDirectory, { force: true, recursive: true }),
    rm(paths.browserUseDirectory, { force: true, recursive: true }),
  ]);
  return {
    detachedDaemonMayRemain: runtimeStateRemoved,
    paths,
    registry,
    runtimeStateRemoved,
  };
}
