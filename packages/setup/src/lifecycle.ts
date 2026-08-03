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
  installPlaywrightSkill,
  uninstallBrowserUseSkill,
  uninstallPanerelaySkill,
  uninstallPlaywrightSkill,
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
import {
  probeAgentBrowserInstallation,
  type AgentBrowserInstallation,
} from './agent-browser-integration.js';
import {
  installPlaywrightIntegration,
  PANERELAY_PLAYWRIGHT_INTEGRATION_VERSION,
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
  globalSkillPath?: string;
  host: NativeHostInstallationResult;
  browserUseRequested?: boolean;
  browserUseIntegration?: BrowserUseIntegrationInstallation;
  browserUseReady?: boolean;
  browserUseSkillPath?: string;
  browserUseVersions?: BrowserUseVersions;
  playwrightInstallation?: PlaywrightInstallation;
  playwrightIntegration?: PlaywrightIntegrationInstallation;
  playwrightSkillPath?: string;
  projectConfigPath?: string;
  projectSkillPath?: string;
}

export interface PanerelayUninstallResult {
  agentBrowserConfigPath: string;
  browserUseIntegration: BrowserUseIntegrationUninstallResult;
  playwrightIntegration: Awaited<ReturnType<typeof uninstallPlaywrightIntegration>>;
  playwrightSkillPath: string;
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
  probeAgentBrowser?: typeof probeAgentBrowserInstallation;
  installSkill?: typeof installPanerelaySkill;
  registerProvider?: typeof registerPanerelayProvider;
  removeProject?: typeof removeProjectProvider;
  uninstallHost?: typeof uninstallNativeHost;
  uninstallBrowserUse?: typeof uninstallBrowserUseIntegrationArtifacts;
  uninstallBrowserUseSkill?: typeof uninstallBrowserUseSkill;
  installPlaywright?: typeof installPlaywrightIntegration;
  installPlaywrightSkill?: typeof installPlaywrightSkill;
  probePlaywright?: typeof probePlaywrightInstallation;
  uninstallPlaywright?: typeof uninstallPlaywrightIntegration;
  uninstallPlaywrightSkill?: typeof uninstallPlaywrightSkill;
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
  const installPlaywright = dependencies.installPlaywright ?? installPlaywrightIntegration;
  const installSelectedPlaywrightSkill =
    dependencies.installPlaywrightSkill ?? installPlaywrightSkill;
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
  const globalSkillPath = options.agentBrowser
    ? await installSkill('global', {
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
  const playwrightIntegration = options.playwright
    ? await installPlaywright({
        environment: options.environment,
        homeDirectory: options.homeDirectory,
        nodePath: process.execPath,
        platform: options.platform,
        playwrightInstallation,
      })
    : undefined;
  const playwrightSkillPath =
    playwrightIntegration && playwrightInstallation?.supported
      ? await installSelectedPlaywrightSkill({
          homeDirectory: options.homeDirectory,
          setupVersion: PANERELAY_PLAYWRIGHT_INTEGRATION_VERSION,
        })
      : undefined;
  const browserUseSkillPath =
    browserUseIntegration && browserUseReady
      ? await installSelectedBrowserUseSkill({
          homeDirectory: options.homeDirectory,
          setupVersion: browserUseIntegration.config.version,
        })
      : undefined;

  if (!options.project) {
    return {
      host,
      ...(agentBrowserInstallation ? { agentBrowserInstallation } : {}),
      ...(agentBrowserConfigPath ? { agentBrowserConfigPath } : {}),
      browserUseRequested: options.browserUse === true,
      ...(browserUseIntegration ? { browserUseIntegration } : {}),
      ...(browserUseSkillPath ? { browserUseSkillPath } : {}),
      ...(browserUseVersions
        ? {
            browserUseVersions,
            browserUseReady,
          }
        : {}),
      ...(playwrightInstallation ? { playwrightInstallation } : {}),
      ...(playwrightIntegration ? { playwrightIntegration } : {}),
      ...(playwrightSkillPath ? { playwrightSkillPath } : {}),
      globalDefault: options.globalDefault === true,
      ...(globalSkillPath ? { globalSkillPath } : {}),
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
    ...(agentBrowserInstallation ? { agentBrowserInstallation } : {}),
    ...(agentBrowserConfigPath ? { agentBrowserConfigPath } : {}),
    browserUseRequested: options.browserUse === true,
    ...(browserUseIntegration ? { browserUseIntegration } : {}),
    ...(browserUseSkillPath ? { browserUseSkillPath } : {}),
    ...(browserUseVersions
      ? {
          browserUseVersions,
          browserUseReady,
        }
      : {}),
    ...(playwrightInstallation ? { playwrightInstallation } : {}),
    ...(playwrightIntegration ? { playwrightIntegration } : {}),
    ...(playwrightSkillPath ? { playwrightSkillPath } : {}),
    globalDefault: options.globalDefault === true,
    ...(globalSkillPath ? { globalSkillPath } : {}),
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
  const playwrightSkillPath = await (
    dependencies.uninstallPlaywrightSkill ?? uninstallPlaywrightSkill
  )(options.homeDirectory);
  const browserUseSkillPath = await uninstallSelectedBrowserUseSkill(options.homeDirectory);

  if (!options.project) {
    return {
      agentBrowserConfigPath,
      browserUseIntegration,
      playwrightIntegration,
      playwrightSkillPath,
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
    playwrightIntegration,
    playwrightSkillPath,
    browserUseSkillPath,
    globalSkillPath,
    projectConfigPath,
    projectSkillPath,
  };
}
