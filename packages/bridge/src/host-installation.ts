import { constants } from 'node:fs';
import { access, chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PANERELAY_EXTENSION_ID, PANERELAY_NATIVE_HOST_NAME } from '@panerelay/protocol';

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
}

export interface NativeHostInstallationPaths {
  agentBrowserConfigPath: string;
  hostPath: string;
  legacyHostPath: string;
  manifestPaths: string[];
  runtimeConfigPath: string;
}

export interface NativeHostInstallationResult extends NativeHostInstallationPaths {
  agentBrowserPath?: string;
  codexPath?: string;
  extensionId: string;
}

export function resolveNativeHostInstallationPaths(
  options: NativeHostPathOptions = {},
): NativeHostInstallationPaths {
  const home = options.homeDirectory ?? homedir();
  const dataDirectory = options.dataDirectory ?? join(home, '.panerelay');
  const hostDirectory = join(dataDirectory, 'bin');
  return {
    agentBrowserConfigPath: join(dataDirectory, 'agent-browser.json'),
    hostPath: join(hostDirectory, 'panerelay-native-host.cjs'),
    legacyHostPath: join(hostDirectory, 'panerelay-native-host.mjs'),
    manifestPaths: nativeHostManifestPaths(options),
    runtimeConfigPath: join(dataDirectory, 'runtime.json'),
  };
}

export function nativeHostManifestPaths(options: NativeHostPathOptions = {}): string[] {
  const home = options.homeDirectory ?? homedir();
  const filename = `${PANERELAY_NATIVE_HOST_NAME}.json`;
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
      ].map(browser => join(home, '.config', browser, 'NativeMessagingHosts', filename));
      return [...profilePaths, ...browserPaths];
    }
    default:
      throw new Error(
        `Native Messaging installation is not implemented for ${options.platform ?? process.platform}`,
      );
  }
}

async function resolveExecutable(
  name: string,
  configuredPath: string | undefined,
  environment: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  const candidates = configuredPath
    ? [configuredPath]
    : isAbsolute(name)
      ? [name]
      : (environment.PATH || '')
          .split(delimiter)
          .filter(Boolean)
          .map(directory => join(directory, name));
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue through PATH entries until an executable is found.
    }
  }
  return undefined;
}

export async function installNativeHost(
  options: NativeHostInstallOptions = {},
): Promise<NativeHostInstallationResult> {
  const environment = options.environment ?? process.env;
  const paths = resolveNativeHostInstallationPaths(options);
  const extensionId = options.extensionId ?? PANERELAY_EXTENSION_ID;
  const bundledHostPath =
    options.bundledHostPath ?? fileURLToPath(new URL('./native-host.bundle.cjs', import.meta.url));
  const bundledHost = await readFile(bundledHostPath, 'utf8');
  const installedHost = bundledHost.replace(
    /^#![^\n]*/,
    `#!${options.nodePath ?? process.execPath}`,
  );

  await mkdir(dirname(paths.hostPath), { recursive: true, mode: 0o700 });
  await writeFile(paths.hostPath, installedHost, { mode: 0o755 });
  await chmod(paths.hostPath, 0o755);
  await rm(paths.legacyHostPath, { force: true });

  const codexPath = await resolveExecutable('codex', environment.PANERELAY_CODEX_PATH, environment);
  const agentBrowserPath = await resolveExecutable(
    'agent-browser',
    environment.PANERELAY_AGENT_BROWSER_PATH,
    environment,
  );
  await writeFile(
    paths.runtimeConfigPath,
    `${JSON.stringify(
      {
        ...(codexPath ? { codexPath } : {}),
        ...(agentBrowserPath ? { agentBrowserPath } : {}),
        agentBrowserConfigPath: paths.agentBrowserConfigPath,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  await chmod(paths.runtimeConfigPath, 0o600);
  await writeFile(
    paths.agentBrowserConfigPath,
    `${JSON.stringify(
      {
        plugins: [
          {
            name: 'panerelay',
            command: paths.hostPath,
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
  await chmod(paths.agentBrowserConfigPath, 0o600);

  const manifest = `${JSON.stringify(
    {
      name: PANERELAY_NATIVE_HOST_NAME,
      description: 'PaneRelay local browser and agent bridge',
      path: paths.hostPath,
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

  return {
    ...paths,
    extensionId,
    ...(codexPath ? { codexPath } : {}),
    ...(agentBrowserPath ? { agentBrowserPath } : {}),
  };
}

export async function uninstallNativeHost(
  options: NativeHostPathOptions = {},
): Promise<NativeHostInstallationPaths> {
  const paths = resolveNativeHostInstallationPaths(options);
  await Promise.all(paths.manifestPaths.map(manifestPath => rm(manifestPath, { force: true })));
  await Promise.all([
    rm(paths.hostPath, { force: true }),
    rm(paths.legacyHostPath, { force: true }),
    rm(paths.runtimeConfigPath, { force: true }),
    rm(paths.agentBrowserConfigPath, { force: true }),
  ]);
  return paths;
}
