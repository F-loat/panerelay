import {
  installNativeHost,
  uninstallNativeHost,
  type NativeHostInstallationResult,
} from '@panerelay/bridge/install';
import {
  clearGlobalProvider,
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
import {
  installClaudeFetchIntegration,
  installCodexFetchIntegration,
  uninstallClaudeFetchIntegration,
  uninstallCodexFetchIntegration,
} from './agent-fetch-integration.js';

export interface PanerelaySetupOptions {
  agentBrowser?: boolean;
  browserUse?: boolean;
  claudeFetch?: boolean;
  codexFetch?: boolean;
  removeClaudeFetch?: boolean;
  removeCodexFetch?: boolean;
  playwright?: boolean;
  browserUseDefault?: 'direct' | 'extension';
  environment?: NodeJS.ProcessEnv;
  extensionId?: string;
  globalDefault?: boolean;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  project?: boolean;
  projectDirectory?: string;
  reconcileIntegrations?: boolean;
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
  claudeFetchConfigPaths?: Awaited<ReturnType<typeof installClaudeFetchIntegration>>;
  codexFetchConfigPath?: string;
  playwrightInstallation?: PlaywrightInstallation;
  playwrightIntegration?: PlaywrightIntegrationInstallation;
  removedAgentBrowserConfigPath?: string;
  removedBrowserUseIntegration?: BrowserUseIntegrationUninstallResult;
  removedClaudeFetchConfigPaths?: Awaited<ReturnType<typeof uninstallClaudeFetchIntegration>>;
  removedCodexFetchConfigPath?: string;
  removedPlaywrightIntegration?: Awaited<ReturnType<typeof uninstallPlaywrightIntegration>>;
  projectConfigPath?: string;
}

export interface PanerelayUninstallResult {
  agentBrowserConfigPath: string;
  browserUseIntegration: BrowserUseIntegrationUninstallResult;
  claudeFetchConfigPaths?: Awaited<ReturnType<typeof uninstallClaudeFetchIntegration>>;
  codexFetchConfigPath?: string;
  playwrightIntegration: Awaited<ReturnType<typeof uninstallPlaywrightIntegration>>;
  projectConfigPath?: string;
}

export interface LifecycleDependencies {
  clearGlobal?: typeof clearGlobalProvider;
  configureGlobal?: typeof configureGlobalProvider;
  configureProject?: typeof configureProjectProvider;
  installHost?: typeof installNativeHost;
  installBrowserUse?: typeof installBrowserUseIntegrationArtifacts;
  installClaudeFetch?: typeof installClaudeFetchIntegration;
  installCodexFetch?: typeof installCodexFetchIntegration;
  probeBrowserUse?: typeof probeBrowserUseVersions;
  probeAgentBrowser?: typeof probeAgentBrowserInstallation;
  registerProvider?: typeof registerPanerelayProvider;
  removeProject?: typeof removeProjectProvider;
  uninstallHost?: typeof uninstallNativeHost;
  uninstallBrowserUse?: typeof uninstallBrowserUseIntegrationArtifacts;
  uninstallClaudeFetch?: typeof uninstallClaudeFetchIntegration;
  uninstallCodexFetch?: typeof uninstallCodexFetchIntegration;
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
  const clearGlobal = dependencies.clearGlobal ?? clearGlobalProvider;
  const installBrowserUse = dependencies.installBrowserUse ?? installBrowserUseIntegrationArtifacts;
  const configureProject = dependencies.configureProject ?? configureProjectProvider;
  const installPlaywright = dependencies.installPlaywright ?? installPlaywrightIntegration;
  const reconcileIntegrations = options.reconcileIntegrations === true;
  if (options.globalDefault && !options.agentBrowser && !options.browserUse) {
    throw new Error('--global-default requires agentBrowser or browserUse: true');
  }
  if (options.project && !options.agentBrowser) {
    throw new Error('agent-browser Provider project scope requires agentBrowser: true');
  }
  if (options.claudeFetch && options.removeClaudeFetch) {
    throw new Error('claudeFetch and removeClaudeFetch are mutually exclusive');
  }
  if (options.codexFetch && options.removeCodexFetch) {
    throw new Error('codexFetch and removeCodexFetch are mutually exclusive');
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
  } else if (reconcileIntegrations && options.agentBrowser) {
    await clearGlobal({ homeDirectory: options.homeDirectory });
  }
  const removedAgentBrowserConfigPath =
    reconcileIntegrations && !options.agentBrowser
      ? await (dependencies.unregisterProvider ?? unregisterPanerelayProvider)({
          homeDirectory: options.homeDirectory,
        })
      : undefined;
  const codexFetchConfigPath = options.codexFetch
    ? await (dependencies.installCodexFetch ?? installCodexFetchIntegration)(host.launchPath, {
        homeDirectory: options.homeDirectory,
      })
    : undefined;
  const claudeFetchConfigPaths = options.claudeFetch
    ? await (dependencies.installClaudeFetch ?? installClaudeFetchIntegration)(host.launchPath, {
        homeDirectory: options.homeDirectory,
      })
    : undefined;
  const removedCodexFetchConfigPath = options.removeCodexFetch
    ? await (dependencies.uninstallCodexFetch ?? uninstallCodexFetchIntegration)({
        homeDirectory: options.homeDirectory,
      })
    : undefined;
  const removedClaudeFetchConfigPaths = options.removeClaudeFetch
    ? await (dependencies.uninstallClaudeFetch ?? uninstallClaudeFetchIntegration)({
        homeDirectory: options.homeDirectory,
      })
    : undefined;
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
          options.browserUseDefault ??
          (options.globalDefault ? 'extension' : reconcileIntegrations ? 'direct' : undefined),
        browserUseVersions,
        environment: options.environment,
        homeDirectory: options.homeDirectory,
        platform: options.platform,
      })
    : undefined;
  const removedBrowserUseIntegration =
    reconcileIntegrations && !options.browserUse
      ? await (dependencies.uninstallBrowserUse ?? uninstallBrowserUseIntegrationArtifacts)({
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
  const removedPlaywrightIntegration =
    reconcileIntegrations && !options.playwright
      ? await (dependencies.uninstallPlaywright ?? uninstallPlaywrightIntegration)({
          environment: options.environment,
          homeDirectory: options.homeDirectory,
          platform: options.platform,
        })
      : undefined;
  if (!options.project) {
    return {
      host,
      ...(agentBrowserInstallation ? { agentBrowserInstallation } : {}),
      ...(agentBrowserConfigPath ? { agentBrowserConfigPath } : {}),
      browserUseRequested: options.browserUse === true,
      ...(browserUseIntegration ? { browserUseIntegration } : {}),
      ...(codexFetchConfigPath ? { codexFetchConfigPath } : {}),
      ...(claudeFetchConfigPaths ? { claudeFetchConfigPaths } : {}),
      ...(removedCodexFetchConfigPath ? { removedCodexFetchConfigPath } : {}),
      ...(removedClaudeFetchConfigPaths ? { removedClaudeFetchConfigPaths } : {}),
      ...(browserUseVersions
        ? {
            browserUseVersions,
            browserUseReady,
          }
        : {}),
      ...(playwrightInstallation ? { playwrightInstallation } : {}),
      ...(playwrightIntegration ? { playwrightIntegration } : {}),
      ...(removedAgentBrowserConfigPath ? { removedAgentBrowserConfigPath } : {}),
      ...(removedBrowserUseIntegration ? { removedBrowserUseIntegration } : {}),
      ...(removedPlaywrightIntegration ? { removedPlaywrightIntegration } : {}),
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
    ...(codexFetchConfigPath ? { codexFetchConfigPath } : {}),
    ...(claudeFetchConfigPaths ? { claudeFetchConfigPaths } : {}),
    ...(removedCodexFetchConfigPath ? { removedCodexFetchConfigPath } : {}),
    ...(removedClaudeFetchConfigPaths ? { removedClaudeFetchConfigPaths } : {}),
    ...(browserUseVersions
      ? {
          browserUseVersions,
          browserUseReady,
        }
      : {}),
    ...(playwrightInstallation ? { playwrightInstallation } : {}),
    ...(playwrightIntegration ? { playwrightIntegration } : {}),
    ...(removedAgentBrowserConfigPath ? { removedAgentBrowserConfigPath } : {}),
    ...(removedBrowserUseIntegration ? { removedBrowserUseIntegration } : {}),
    ...(removedPlaywrightIntegration ? { removedPlaywrightIntegration } : {}),
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
  const codexFetchConfigPath = await (
    dependencies.uninstallCodexFetch ?? uninstallCodexFetchIntegration
  )({ homeDirectory: options.homeDirectory });
  const claudeFetchConfigPaths = await (
    dependencies.uninstallClaudeFetch ?? uninstallClaudeFetchIntegration
  )({ homeDirectory: options.homeDirectory });
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
      ...(codexFetchConfigPath ? { codexFetchConfigPath } : {}),
      ...(claudeFetchConfigPaths ? { claudeFetchConfigPaths } : {}),
      playwrightIntegration,
    };
  }
  const projectConfigPath = await removeProject({
    projectDirectory: options.projectDirectory,
  });
  return {
    agentBrowserConfigPath,
    browserUseIntegration,
    ...(codexFetchConfigPath ? { codexFetchConfigPath } : {}),
    ...(claudeFetchConfigPaths ? { claudeFetchConfigPaths } : {}),
    playwrightIntegration,
    projectConfigPath,
  };
}
