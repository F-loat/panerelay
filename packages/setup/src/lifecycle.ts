import {
  installNativeHost,
  uninstallNativeHost,
  type NativeHostInstallationResult,
} from '@panerelay/bridge/install';
import {
  configureGlobalProvider,
  configureProjectProvider,
  registerPanerelayProvider,
  removeProjectProvider,
  unregisterPanerelayProvider,
} from './config.js';
import {
  installBrowserUseIntegrationArtifacts,
  uninstallBrowserUseIntegrationArtifacts,
  type BrowserUseIntegrationInstallation,
  type BrowserUseIntegrationUninstallResult,
} from './browser-use-integration.js';
import {
  isBrowserUseInstallationSupported,
  probeBrowserUseVersions,
  type BrowserUseVersions,
} from '@panerelay/browser-use';
import {
  probeAgentBrowserInstallation,
  type AgentBrowserInstallation,
} from './agent-browser-integration.js';
import {
  installPlaywrightIntegration,
  type PlaywrightIntegrationInstallation,
  uninstallPlaywrightIntegration,
} from './playwright-integration.js';
import { probePlaywrightInstallation, type PlaywrightInstallation } from '@panerelay/playwright';

export interface PanerelaySetupOptions {
  agentBrowser?: boolean;
  browserUse?: boolean;
  playwright?: boolean;
  browserUseDefault?: 'direct' | 'extension';
  environment?: NodeJS.ProcessEnv;
  extensionId?: string;
  globalDefault?: boolean;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  project?: boolean;
  projectDirectory?: string;
}

export interface PanerelaySetupResult {
  agentBrowserInstallation?: AgentBrowserInstallation;
  agentBrowserConfigPath?: string;
  globalDefault: boolean;
  host: NativeHostInstallationResult;
  browserUseRequested?: boolean;
  browserUseIntegration?: BrowserUseIntegrationInstallation;
  browserUseReady?: boolean;
  browserUseVersions?: BrowserUseVersions;
  playwrightInstallation?: PlaywrightInstallation;
  playwrightIntegration?: PlaywrightIntegrationInstallation;
  projectConfigPath?: string;
}

export interface PanerelayUninstallResult {
  agentBrowserConfigPath: string;
  browserUseIntegration: BrowserUseIntegrationUninstallResult;
  playwrightIntegration: Awaited<ReturnType<typeof uninstallPlaywrightIntegration>>;
  projectConfigPath?: string;
}

export interface LifecycleDependencies {
  configureGlobal?: typeof configureGlobalProvider;
  configureProject?: typeof configureProjectProvider;
  installHost?: typeof installNativeHost;
  installBrowserUse?: typeof installBrowserUseIntegrationArtifacts;
  probeBrowserUse?: typeof probeBrowserUseVersions;
  probeAgentBrowser?: typeof probeAgentBrowserInstallation;
  registerProvider?: typeof registerPanerelayProvider;
  removeProject?: typeof removeProjectProvider;
  uninstallHost?: typeof uninstallNativeHost;
  uninstallBrowserUse?: typeof uninstallBrowserUseIntegrationArtifacts;
  installPlaywright?: typeof installPlaywrightIntegration;
  probePlaywright?: typeof probePlaywrightInstallation;
  uninstallPlaywright?: typeof uninstallPlaywrightIntegration;
  unregisterProvider?: typeof unregisterPanerelayProvider;
}

export async function setupPanerelay(
  options: PanerelaySetupOptions = {},
  dependencies: LifecycleDependencies = {},
): Promise<PanerelaySetupResult> {
  const installHost = dependencies.installHost ?? installNativeHost;
  const registerProvider = dependencies.registerProvider ?? registerPanerelayProvider;
  const configureGlobal = dependencies.configureGlobal ?? configureGlobalProvider;
  const installBrowserUse = dependencies.installBrowserUse ?? installBrowserUseIntegrationArtifacts;
  const configureProject = dependencies.configureProject ?? configureProjectProvider;
  const installPlaywright = dependencies.installPlaywright ?? installPlaywrightIntegration;
  if (options.globalDefault && !options.agentBrowser && !options.browserUse) {
    throw new Error('--global-default requires agentBrowser or browserUse: true');
  }
  if (options.project && !options.agentBrowser) {
    throw new Error('agent-browser Provider project scope requires agentBrowser: true');
  }
  const agentBrowserInstallation = options.agentBrowser
    ? await (dependencies.probeAgentBrowser ?? probeAgentBrowserInstallation)({
        environment: options.environment,
        platform: options.platform,
      })
    : undefined;
  const host = await installHost({
    environment: options.environment,
    extensionId: options.extensionId,
    homeDirectory: options.homeDirectory,
    platform: options.platform,
  });
  const agentBrowserConfigPath = options.agentBrowser
    ? await registerProvider(host.launchPath, {
        homeDirectory: options.homeDirectory,
      })
    : undefined;
  if (options.globalDefault && options.agentBrowser) {
    await configureGlobal({ homeDirectory: options.homeDirectory });
  }
  const browserUseVersions = options.browserUse
    ? await (dependencies.probeBrowserUse ?? probeBrowserUseVersions)(
        options.environment,
        options.platform,
      )
    : undefined;
  const browserUseReady = browserUseVersions
    ? isBrowserUseInstallationSupported(browserUseVersions)
    : false;
  const browserUseIntegration = options.browserUse
    ? await installBrowserUse({
        browserUseDefault:
          options.browserUseDefault ?? (options.globalDefault ? 'extension' : undefined),
        browserUseVersions,
        environment: options.environment,
        homeDirectory: options.homeDirectory,
        platform: options.platform,
      })
    : undefined;
  const playwrightInstallation = options.playwright
    ? await (dependencies.probePlaywright ?? probePlaywrightInstallation)(
        options.environment,
        options.platform,
      )
    : undefined;
  const playwrightReady =
    playwrightInstallation?.supported === true && Boolean(playwrightInstallation.executable);
  const playwrightIntegration =
    options.playwright && playwrightReady
      ? await installPlaywright({
          environment: options.environment,
          homeDirectory: options.homeDirectory,
          nodePath: process.execPath,
          platform: options.platform,
          playwrightInstallation,
        })
      : undefined;
  if (!options.project) {
    return {
      host,
      ...(agentBrowserInstallation ? { agentBrowserInstallation } : {}),
      ...(agentBrowserConfigPath ? { agentBrowserConfigPath } : {}),
      browserUseRequested: options.browserUse === true,
      ...(browserUseIntegration ? { browserUseIntegration } : {}),
      ...(browserUseVersions
        ? {
            browserUseVersions,
            browserUseReady,
          }
        : {}),
      ...(playwrightInstallation ? { playwrightInstallation } : {}),
      ...(playwrightIntegration ? { playwrightIntegration } : {}),
      globalDefault: options.globalDefault === true,
    };
  }
  const projectConfigPath = await configureProject({
    projectDirectory: options.projectDirectory,
  });
  return {
    host,
    ...(agentBrowserInstallation ? { agentBrowserInstallation } : {}),
    ...(agentBrowserConfigPath ? { agentBrowserConfigPath } : {}),
    browserUseRequested: options.browserUse === true,
    ...(browserUseIntegration ? { browserUseIntegration } : {}),
    ...(browserUseVersions
      ? {
          browserUseVersions,
          browserUseReady,
        }
      : {}),
    ...(playwrightInstallation ? { playwrightInstallation } : {}),
    ...(playwrightIntegration ? { playwrightIntegration } : {}),
    globalDefault: options.globalDefault === true,
    projectConfigPath,
  };
}

export async function uninstallPanerelay(
  options: PanerelaySetupOptions = {},
  dependencies: LifecycleDependencies = {},
): Promise<PanerelayUninstallResult> {
  const uninstallHost = dependencies.uninstallHost ?? uninstallNativeHost;
  const unregisterProvider = dependencies.unregisterProvider ?? unregisterPanerelayProvider;
  const uninstallSelectedBrowserUse =
    dependencies.uninstallBrowserUse ?? uninstallBrowserUseIntegrationArtifacts;
  const removeProject = dependencies.removeProject ?? removeProjectProvider;
  await uninstallHost({
    homeDirectory: options.homeDirectory,
    platform: options.platform,
  });
  const agentBrowserConfigPath = await unregisterProvider({
    homeDirectory: options.homeDirectory,
  });
  const browserUseIntegration = await uninstallSelectedBrowserUse({
    environment: options.environment,
    homeDirectory: options.homeDirectory,
    platform: options.platform,
  });
  const playwrightIntegration = await (
    dependencies.uninstallPlaywright ?? uninstallPlaywrightIntegration
  )({
    environment: options.environment,
    homeDirectory: options.homeDirectory,
    platform: options.platform,
  });
  if (!options.project) {
    return {
      agentBrowserConfigPath,
      browserUseIntegration,
      playwrightIntegration,
    };
  }
  const projectConfigPath = await removeProject({
    projectDirectory: options.projectDirectory,
  });
  return {
    agentBrowserConfigPath,
    browserUseIntegration,
    playwrightIntegration,
    projectConfigPath,
  };
}
