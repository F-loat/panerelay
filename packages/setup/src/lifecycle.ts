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
import { installPanerelaySkill, uninstallPanerelaySkill } from './skill.js';

export interface PanerelaySetupOptions {
  environment?: NodeJS.ProcessEnv;
  extensionId?: string;
  firefoxExtensionId?: string;
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
  projectConfigPath?: string;
  projectSkillPath?: string;
}

export interface PanerelayUninstallResult {
  agentBrowserConfigPath: string;
  globalSkillPath: string;
  projectConfigPath?: string;
  projectSkillPath?: string;
}

export interface LifecycleDependencies {
  configureGlobal?: typeof configureGlobalProvider;
  configureProject?: typeof configureProjectProvider;
  installHost?: typeof installNativeHost;
  installSkill?: typeof installPanerelaySkill;
  registerProvider?: typeof registerPanerelayProvider;
  removeProject?: typeof removeProjectProvider;
  uninstallHost?: typeof uninstallNativeHost;
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
  const configureProject = dependencies.configureProject ?? configureProjectProvider;
  const host = await installHost({
    environment: options.environment,
    extensionId: options.extensionId,
    firefoxExtensionId: options.firefoxExtensionId,
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

  if (!options.project) {
    return {
      host,
      agentBrowserConfigPath,
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

  if (!options.project) return { agentBrowserConfigPath, globalSkillPath };
  const projectConfigPath = await removeProject({
    projectDirectory: options.projectDirectory,
  });
  const projectSkillPath = await uninstallSkill('project', {
    projectDirectory: options.projectDirectory,
  });
  return {
    agentBrowserConfigPath,
    globalSkillPath,
    projectConfigPath,
    projectSkillPath,
  };
}
