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
  installBrowserUseSkill,
  installPanerelaySkill,
  uninstallBrowserUseSkill,
  uninstallPanerelaySkill,
} from './skill.js';
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

export interface PanerelaySetupOptions {
  browserUse?: boolean;
  environment?: NodeJS.ProcessEnv;
  extensionId?: string;
  globalProvider?: boolean;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  project?: boolean;
  projectDirectory?: string;
}

export interface PanerelaySetupResult {
  agentBrowserConfigPath: string;
  globalProvider: boolean;
  globalSkillPath: string;
  host: NativeHostInstallationResult;
  browserUseRequested?: boolean;
  browserUseIntegration?: BrowserUseIntegrationInstallation;
  browserUseReady?: boolean;
  browserUseSkillPath?: string;
  browserUseVersions?: BrowserUseVersions;
  projectConfigPath?: string;
  projectSkillPath?: string;
}

export interface PanerelayUninstallResult {
  agentBrowserConfigPath: string;
  browserUseIntegration: BrowserUseIntegrationUninstallResult;
  browserUseSkillPath: string;
  globalSkillPath: string;
  projectConfigPath?: string;
  projectSkillPath?: string;
}

export interface LifecycleDependencies {
  configureGlobal?: typeof configureGlobalProvider;
  configureProject?: typeof configureProjectProvider;
  installHost?: typeof installNativeHost;
  installBrowserUse?: typeof installBrowserUseIntegrationArtifacts;
  installBrowserUseSkill?: typeof installBrowserUseSkill;
  probeBrowserUse?: typeof probeBrowserUseVersions;
  installSkill?: typeof installPanerelaySkill;
  registerProvider?: typeof registerPanerelayProvider;
  removeProject?: typeof removeProjectProvider;
  uninstallHost?: typeof uninstallNativeHost;
  uninstallBrowserUse?: typeof uninstallBrowserUseIntegrationArtifacts;
  uninstallBrowserUseSkill?: typeof uninstallBrowserUseSkill;
  uninstallSkill?: typeof uninstallPanerelaySkill;
  unregisterProvider?: typeof unregisterPanerelayProvider;
}

export async function setupPanerelay(
  options: PanerelaySetupOptions = {},
  dependencies: LifecycleDependencies = {},
): Promise<PanerelaySetupResult> {
  const installHost = dependencies.installHost ?? installNativeHost;
  const registerProvider = dependencies.registerProvider ?? registerPanerelayProvider;
  const configureGlobal = dependencies.configureGlobal ?? configureGlobalProvider;
  const installSkill = dependencies.installSkill ?? installPanerelaySkill;
  const installBrowserUse = dependencies.installBrowserUse ?? installBrowserUseIntegrationArtifacts;
  const installSelectedBrowserUseSkill =
    dependencies.installBrowserUseSkill ?? installBrowserUseSkill;
  const configureProject = dependencies.configureProject ?? configureProjectProvider;
  const host = await installHost({
    environment: options.environment,
    extensionId: options.extensionId,
    homeDirectory: options.homeDirectory,
    platform: options.platform,
  });
  const agentBrowserConfigPath = await registerProvider(host.launchPath, {
    homeDirectory: options.homeDirectory,
  });
  if (options.globalProvider) {
    await configureGlobal({ homeDirectory: options.homeDirectory });
  }
  const globalSkillPath = await installSkill('global', {
    homeDirectory: options.homeDirectory,
  });
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
        browserUseVersions,
        homeDirectory: options.homeDirectory,
        platform: options.platform,
      })
    : undefined;
  const browserUseSkillPath =
    browserUseIntegration && browserUseReady
      ? await installSelectedBrowserUseSkill(browserUseIntegration.paths.cliLauncherPath, {
          browserUseExecutable: browserUseVersions!.browserUseExecutable!,
          homeDirectory: options.homeDirectory,
          mcpLauncherPath: browserUseIntegration.config.mcpLauncherPath,
          platform: options.platform,
          setupVersion: browserUseIntegration.config.version,
        })
      : undefined;

  if (!options.project) {
    return {
      host,
      agentBrowserConfigPath,
      browserUseRequested: options.browserUse === true,
      ...(browserUseIntegration ? { browserUseIntegration } : {}),
      ...(browserUseSkillPath ? { browserUseSkillPath } : {}),
      ...(browserUseVersions
        ? {
            browserUseVersions,
            browserUseReady,
          }
        : {}),
      globalProvider: options.globalProvider === true,
      globalSkillPath,
    };
  }
  const projectConfigPath = await configureProject({
    projectDirectory: options.projectDirectory,
  });
  const projectSkillPath = await installSkill('project', {
    projectDirectory: options.projectDirectory,
  });
  return {
    host,
    agentBrowserConfigPath,
    browserUseRequested: options.browserUse === true,
    ...(browserUseIntegration ? { browserUseIntegration } : {}),
    ...(browserUseSkillPath ? { browserUseSkillPath } : {}),
    ...(browserUseVersions
      ? {
          browserUseVersions,
          browserUseReady,
        }
      : {}),
    globalProvider: options.globalProvider === true,
    globalSkillPath,
    projectConfigPath,
    projectSkillPath,
  };
}

export async function uninstallPanerelay(
  options: PanerelaySetupOptions = {},
  dependencies: LifecycleDependencies = {},
): Promise<PanerelayUninstallResult> {
  const uninstallHost = dependencies.uninstallHost ?? uninstallNativeHost;
  const unregisterProvider = dependencies.unregisterProvider ?? unregisterPanerelayProvider;
  const uninstallSkill = dependencies.uninstallSkill ?? uninstallPanerelaySkill;
  const uninstallSelectedBrowserUse =
    dependencies.uninstallBrowserUse ?? uninstallBrowserUseIntegrationArtifacts;
  const uninstallSelectedBrowserUseSkill =
    dependencies.uninstallBrowserUseSkill ?? uninstallBrowserUseSkill;
  const removeProject = dependencies.removeProject ?? removeProjectProvider;
  await uninstallHost({
    homeDirectory: options.homeDirectory,
    platform: options.platform,
  });
  const agentBrowserConfigPath = await unregisterProvider({
    homeDirectory: options.homeDirectory,
  });
  const globalSkillPath = await uninstallSkill('global', {
    homeDirectory: options.homeDirectory,
  });
  const browserUseIntegration = await uninstallSelectedBrowserUse({
    homeDirectory: options.homeDirectory,
    platform: options.platform,
  });
  const browserUseSkillPath = await uninstallSelectedBrowserUseSkill(options.homeDirectory);

  if (!options.project) {
    return {
      agentBrowserConfigPath,
      browserUseIntegration,
      browserUseSkillPath,
      globalSkillPath,
    };
  }
  const projectConfigPath = await removeProject({
    projectDirectory: options.projectDirectory,
  });
  const projectSkillPath = await uninstallSkill('project', {
    projectDirectory: options.projectDirectory,
  });
  return {
    agentBrowserConfigPath,
    browserUseIntegration,
    browserUseSkillPath,
    globalSkillPath,
    projectConfigPath,
    projectSkillPath,
  };
}
