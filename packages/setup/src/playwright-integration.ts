import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  registerCliAdapter,
  removeCliAdapterRegistration,
  type CliAdapterRegistration,
  type CliAdapterRegistry,
} from '@panerelay/cli';
import {
  playwrightAdapterManifest,
  PLAYWRIGHT_MINIMUM_VERSION,
  type PlaywrightInstallation,
} from '@panerelay/playwright';

export const PANERELAY_PLAYWRIGHT_INTEGRATION_VERSION = '0.4.0' as const;
const CONFIG_PROTOCOL = 'panerelay.playwright-integration.v1' as const;

export interface PlaywrightIntegrationPaths {
  adapterArtifactPath: string;
  adapterLauncherPath: string;
  adapterPackagePath: string;
  adapterStorageDirectory: string;
  configPath: string;
  dataDirectory: string;
}

export interface PlaywrightIntegrationOptions {
  adapterBundlePath?: string;
  dataDirectory?: string;
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  nodePath?: string;
  platform?: NodeJS.Platform;
  playwrightInstallation?: PlaywrightInstallation;
}

export interface PlaywrightIntegrationInstallation {
  paths: PlaywrightIntegrationPaths;
  registration: CliAdapterRegistration;
  registry: CliAdapterRegistry;
}

function home(options: PlaywrightIntegrationOptions): string {
  return (
    options.homeDirectory ??
    options.environment?.HOME ??
    options.environment?.USERPROFILE ??
    homedir()
  );
}

export function resolvePlaywrightIntegrationPaths(
  options: PlaywrightIntegrationOptions = {},
): PlaywrightIntegrationPaths {
  const platform = options.platform ?? process.platform;
  const implementation = platform === 'win32' ? path.win32 : path.posix;
  const root = options.dataDirectory ?? implementation.join(home(options), '.panerelay');
  const storage = implementation.join(
    root,
    'adapters',
    'playwright',
    PANERELAY_PLAYWRIGHT_INTEGRATION_VERSION,
  );
  return {
    adapterArtifactPath: implementation.join(storage, 'dist', 'panerelay-playwright-adapter.mjs'),
    adapterLauncherPath: implementation.join(
      root,
      'bin',
      `panerelay-playwright-adapter${platform === 'win32' ? '.cmd' : ''}`,
    ),
    adapterPackagePath: implementation.join(storage, 'package.json'),
    adapterStorageDirectory: implementation.join(root, 'adapters', 'playwright'),
    configPath: implementation.join(root, 'playwright', 'config.json'),
    dataDirectory: root,
  };
}

function bundledPrivatePath(): string {
  return fileURLToPath(
    new URL('./private/playwright/panerelay-playwright-adapter.mjs', import.meta.url),
  );
}

function quote(value: string): string {
  return `'${value.split("'").join("'\"'\"'")}'`;
}
function launcher(platform: NodeJS.Platform, nodePath: string, scriptPath: string): string {
  if (platform === 'win32')
    return `@echo off\r\n"${nodePath.replaceAll('%', '%%')}" "${scriptPath.replaceAll('%', '%%')}" %*\r\n`;
  return `#!/bin/sh\nexec ${quote(nodePath)} ${quote(scriptPath)} "$@"\n`;
}

async function protectedFile(
  filePath: string,
  content: string | Buffer,
  mode: number,
  platform: NodeJS.Platform,
): Promise<void> {
  const implementation = platform === 'win32' ? path.win32 : path.posix;
  await mkdir(implementation.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, content, { mode });
  await rename(temporary, filePath);
  if (platform !== 'win32') await chmod(filePath, mode);
}

function registration(executablePath: string): CliAdapterRegistration {
  const manifest = playwrightAdapterManifest(PANERELAY_PLAYWRIGHT_INTEGRATION_VERSION);
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

export async function installPlaywrightIntegration(
  options: PlaywrightIntegrationOptions = {},
): Promise<PlaywrightIntegrationInstallation> {
  const platform = options.platform ?? process.platform;
  const paths = resolvePlaywrightIntegrationPaths(options);
  const installation = options.playwrightInstallation;
  if (!installation?.executable || !installation.supported)
    throw new Error(`Playwright CLI ${PLAYWRIGHT_MINIMUM_VERSION} or newer is required`);
  const bundle = await readFile(options.adapterBundlePath ?? bundledPrivatePath());
  await Promise.all([
    protectedFile(paths.adapterArtifactPath, bundle, 0o600, platform),
    protectedFile(
      paths.adapterPackagePath,
      `${JSON.stringify(
        {
          name: '@panerelay/playwright-private',
          version: PANERELAY_PLAYWRIGHT_INTEGRATION_VERSION,
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
  await protectedFile(
    paths.adapterLauncherPath,
    launcher(platform, options.nodePath ?? process.execPath, paths.adapterArtifactPath),
    0o700,
    platform,
  );
  await protectedFile(
    paths.configPath,
    `${JSON.stringify({ adapterId: 'playwright', protocol: CONFIG_PROTOCOL, version: PANERELAY_PLAYWRIGHT_INTEGRATION_VERSION, executable: installation.executable, endpoint: 'http://127.0.0.1:43827/cdp/playwright' }, null, 2)}\n`,
    0o600,
    platform,
  );
  const registry = await registerCliAdapter(registration(paths.adapterLauncherPath), {
    dataDirectory: paths.dataDirectory,
    homeDirectory: home(options),
    platform,
  });
  return { paths, registration: registration(paths.adapterLauncherPath), registry };
}

export async function uninstallPlaywrightIntegration(
  options: PlaywrightIntegrationOptions = {},
): Promise<{ paths: PlaywrightIntegrationPaths; registry: CliAdapterRegistry }> {
  const platform = options.platform ?? process.platform;
  const paths = resolvePlaywrightIntegrationPaths(options);
  const registry = await removeCliAdapterRegistration('playwright', {
    dataDirectory: paths.dataDirectory,
    homeDirectory: home(options),
    platform,
  });
  await rm(paths.adapterLauncherPath, { force: true });
  await rm(paths.adapterStorageDirectory, { force: true, recursive: true });
  await rm(paths.configPath, { force: true });
  return { paths, registry };
}
