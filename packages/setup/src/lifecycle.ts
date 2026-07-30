import {
  installNativeHost,
  uninstallNativeHost,
  type NativeHostInstallationResult,
} from '@panerelay/bridge/install';
import {
  configureGlobalProvider,
  configureProjectProvider,
  registerPaneRelayProvider,
  removeProjectProvider,
  unregisterPaneRelayProvider,
} from './config.js';
import { installPaneRelaySkill, uninstallPaneRelaySkill } from './skill.js';

export interface PaneRelaySetupOptions {
  environment?: NodeJS.ProcessEnv;
  extensionId?: string;
  globalProvider?: boolean;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  project?: boolean;
  projectDirectory?: string;
}

export interface PaneRelaySetupResult {
  agentBrowserConfigPath: string;
  globalProvider: boolean;
  globalSkillPath: string;
  host: NativeHostInstallationResult;
  projectConfigPath?: string;
  projectSkillPath?: string;
}

export interface PaneRelayUninstallResult {
  agentBrowserConfigPath: string;
  globalSkillPath: string;
  projectConfigPath?: string;
  projectSkillPath?: string;
}

export interface LifecycleDependencies {
  configureGlobal?: typeof configureGlobalProvider;
  configureProject?: typeof configureProjectProvider;
  installHost?: typeof installNativeHost;
  installSkill?: typeof installPaneRelaySkill;
  registerProvider?: typeof registerPaneRelayProvider;
  removeProject?: typeof removeProjectProvider;
  uninstallHost?: typeof uninstallNativeHost;
  uninstallSkill?: typeof uninstallPaneRelaySkill;
  unregisterProvider?: typeof unregisterPaneRelayProvider;
}

export async function setupPaneRelay(
  options: PaneRelaySetupOptions = {},
  dependencies: LifecycleDependencies = {},
): Promise<PaneRelaySetupResult> {
  const installHost = dependencies.installHost ?? installNativeHost;
  const registerProvider = dependencies.registerProvider ?? registerPaneRelayProvider;
  const configureGlobal = dependencies.configureGlobal ?? configureGlobalProvider;
  const installSkill = dependencies.installSkill ?? installPaneRelaySkill;
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

export async function uninstallPaneRelay(
  options: PaneRelaySetupOptions = {},
  dependencies: LifecycleDependencies = {},
): Promise<PaneRelayUninstallResult> {
  const uninstallHost = dependencies.uninstallHost ?? uninstallNativeHost;
  const unregisterProvider = dependencies.unregisterProvider ?? unregisterPaneRelayProvider;
  const uninstallSkill = dependencies.uninstallSkill ?? uninstallPaneRelaySkill;
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
