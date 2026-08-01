import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  readWindowsNativeHostRegistryValue,
  resolveEffectiveExtensionId,
  resolveNativeHostInstallationPaths,
} from '@panerelay/bridge/install';
import { isExecutableFile, type CommandRunner } from '@panerelay/bridge/platform';
import {
  AGENT_BROWSER_MINIMUM_VERSION,
  CLAUDE_CODE_MINIMUM_VERSION,
  isClaudeCodeSupported,
  probeAgentBrowserCompatibility,
} from '@panerelay/bridge/compatibility';
import { PANERELAY_EXTENSION_ID, PANERELAY_NATIVE_HOST_NAME } from '@panerelay/protocol';
import {
  listBrowserRegistrations,
  readLiveLegacyBrowserRegistration,
} from '@panerelay/browser-registry';
import {
  probeBrowserUseVersions,
  SUPPORTED_BROWSER_HARNESS_VERSION,
  SUPPORTED_BROWSER_USE_VERSION,
} from '@panerelay/browser-use';
import {
  projectAgentBrowserConfigPath,
  readJsonObject,
  userAgentBrowserConfigPath,
} from './config.js';
import { globalSkillPath, projectSkillPath } from './skill.js';
import { resolveBrowserUseIntegrationPaths } from './browser-use-integration.js';

const SETUP_COMMAND = 'npx --yes @panerelay/setup';

export type DoctorStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
  detail: string;
  hint?: string;
  id: string;
  label: string;
  status: DoctorStatus;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  ok: boolean;
}

export interface DoctorOptions {
  browserUse?: boolean;
  browserUseProbe?: typeof probeBrowserUseVersions;
  environment?: NodeJS.ProcessEnv;
  commandRunner?: CommandRunner;
  extensionId?: string;
  globalProvider?: boolean;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  project?: boolean;
  projectDirectory?: string;
  registryRunner?: CommandRunner;
}

async function exists(path: string, mode = constants.F_OK): Promise<boolean> {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
}

async function nativeManifestCheck(
  manifestPaths: string[],
  launchPath: string,
  extensionId: string,
): Promise<DoctorCheck> {
  for (const manifestPath of manifestPaths) {
    if (!(await exists(manifestPath))) continue;
    try {
      const manifest = await readJsonObject(manifestPath);
      const origins = Array.isArray(manifest.allowed_origins) ? manifest.allowed_origins : [];
      if (
        manifest.name === PANERELAY_NATIVE_HOST_NAME &&
        manifest.path === launchPath &&
        origins.length === 1 &&
        origins[0] === `chrome-extension://${extensionId}/`
      ) {
        return {
          id: 'native-manifest',
          label: 'Chrome Native Messaging manifest',
          status: 'pass',
          detail: manifestPath,
        };
      }
    } catch {
      // Continue to report the invalid installation below.
    }
  }
  return {
    id: 'native-manifest',
    label: 'Chrome Native Messaging manifest',
    status: 'fail',
    detail: 'No valid Panerelay manifest was found',
    hint: `Run: ${SETUP_COMMAND}`,
  };
}

function providerPlugin(config: Record<string, unknown>, hostPath: string): boolean {
  return (
    Array.isArray(config.plugins) &&
    config.plugins.some(
      plugin =>
        plugin &&
        typeof plugin === 'object' &&
        !Array.isArray(plugin) &&
        (plugin as Record<string, unknown>).name === 'panerelay' &&
        (plugin as Record<string, unknown>).command === hostPath,
    )
  );
}

async function executableCheck(
  id: string,
  label: string,
  path: string | undefined,
  hint: string,
  platform: NodeJS.Platform,
): Promise<DoctorCheck> {
  const ready = path ? await isExecutableFile(path, platform) : false;
  return {
    id,
    label,
    status: ready ? 'pass' : 'fail',
    detail: path || 'Not found',
    ...(ready ? {} : { hint }),
  };
}

export async function doctorPanerelay(options: DoctorOptions = {}): Promise<DoctorReport> {
  const home = options.homeDirectory ?? homedir();
  const platform = options.platform ?? process.platform;
  const paths = resolveNativeHostInstallationPaths({
    homeDirectory: home,
    platform,
  });
  const checks: DoctorCheck[] = [];
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] || '0', 10);
  checks.push({
    id: 'node',
    label: 'Node.js',
    status: nodeMajor >= 20 ? 'pass' : 'fail',
    detail: process.version,
    ...(nodeMajor >= 20 ? {} : { hint: 'Install Node.js 20 or newer' }),
  });
  const browserUsePaths = resolveBrowserUseIntegrationPaths({
    homeDirectory: home,
    platform,
  });
  const diagnoseBrowserUse =
    options.browserUse === true || (await exists(browserUsePaths.integrationConfigPath));
  if (diagnoseBrowserUse) {
    const versions = await (options.browserUseProbe ?? probeBrowserUseVersions)(
      options.environment,
      platform,
    );
    const browserUseReady = versions.browserUse === SUPPORTED_BROWSER_USE_VERSION;
    const browserHarnessReady = versions.browserHarness === SUPPORTED_BROWSER_HARNESS_VERSION;
    checks.push({
      id: 'browser-use',
      label: 'Browser Use CLI',
      status: browserUseReady ? 'pass' : 'fail',
      detail: versions.browserUseExecutable
        ? `${versions.browserUseExecutable}${versions.browserUse ? ` (${versions.browserUse})` : ''}`
        : 'Not found',
      ...(browserUseReady
        ? {}
        : {
            hint: versions.browserUse
              ? `Install Browser Use ${SUPPORTED_BROWSER_USE_VERSION}, then run: ${SETUP_COMMAND} doctor --browser-use`
              : `Install Browser Use ${SUPPORTED_BROWSER_USE_VERSION}, then run: ${SETUP_COMMAND} --browser-use`,
          }),
    });
    checks.push({
      id: 'browser-harness',
      label: 'Browser Harness',
      status: browserHarnessReady ? 'pass' : 'fail',
      detail: versions.browserHarness ?? 'Not found',
      ...(browserHarnessReady
        ? {}
        : {
            hint: `Install Browser Harness ${SUPPORTED_BROWSER_HARNESS_VERSION} in the Browser Use environment, then run: ${SETUP_COMMAND} doctor --browser-use`,
          }),
    });
  }
  let runtimeConfig: Record<string, unknown> = {};
  try {
    runtimeConfig = await readJsonObject(paths.runtimeConfigPath);
  } catch {
    // The individual executable checks below provide actionable failures.
  }
  let extensionId: string = PANERELAY_EXTENSION_ID;
  try {
    extensionId = resolveEffectiveExtensionId({
      environment: options.environment,
      extensionId: options.extensionId,
      persistedExtensionId: runtimeConfig.extensionId,
    });
    checks.push({
      id: 'extension-id',
      label: 'Effective Extension ID',
      status: 'pass',
      detail: extensionId,
    });
  } catch (error) {
    checks.push({
      id: 'extension-id',
      label: 'Effective Extension ID',
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error),
      hint: 'Use a 32-character Chrome Extension ID containing only a through p',
    });
  }
  checks.push(
    await executableCheck(
      'native-host',
      'Panerelay Native Host',
      paths.hostPath,
      `Run: ${SETUP_COMMAND}`,
      platform,
    ),
  );
  if (paths.launcherPath) {
    checks.push(
      await executableCheck(
        'native-launcher',
        'Panerelay Native Host launcher',
        paths.launcherPath,
        `Run: ${SETUP_COMMAND}`,
        platform,
      ),
    );
  }
  checks.push(await nativeManifestCheck(paths.manifestPaths, paths.launchPath, extensionId));
  if (platform === 'win32') {
    const expectedManifestPath = paths.manifestPaths[0]!;
    for (const browser of ['chrome', 'edge'] as const) {
      const registryValue = await readWindowsNativeHostRegistryValue({
        browser,
        environment: options.environment,
        runner: options.registryRunner,
      });
      const registryReady = registryValue === expectedManifestPath;
      checks.push({
        id: `windows-registry-${browser}`,
        label: `${browser === 'chrome' ? 'Chrome' : 'Edge'} Native Messaging registry`,
        status: registryReady ? 'pass' : 'fail',
        detail: registryValue || 'Not found',
        ...(registryReady ? {} : { hint: `Run: ${SETUP_COMMAND}` }),
      });
    }
  }
  const codexPath =
    typeof runtimeConfig.codexPath === 'string' ? runtimeConfig.codexPath : undefined;
  const claudePath =
    typeof runtimeConfig.claudePath === 'string' ? runtimeConfig.claudePath : undefined;
  const agentBrowserPath =
    typeof runtimeConfig.agentBrowserPath === 'string' ? runtimeConfig.agentBrowserPath : undefined;
  const qoderPath =
    typeof runtimeConfig.qoderPath === 'string' ? runtimeConfig.qoderPath : undefined;
  checks.push(
    await executableCheck(
      'codex',
      'Codex CLI',
      codexPath,
      `Install Codex CLI, then run: ${SETUP_COMMAND}`,
      platform,
    ),
  );
  const claudeExecutable = claudePath ? await isExecutableFile(claudePath, platform) : false;
  const claudeVersion =
    typeof runtimeConfig.claudeVersion === 'string' ? runtimeConfig.claudeVersion : undefined;
  const claudeReady = claudeExecutable && isClaudeCodeSupported(claudeVersion);
  checks.push({
    id: 'claude',
    label: 'Claude Code CLI (optional)',
    status: claudeReady ? 'pass' : 'warn',
    detail: claudeReady
      ? `${claudePath} (${claudeVersion})`
      : claudeExecutable
        ? `${claudePath}${claudeVersion ? ` (${claudeVersion})` : ' (version unknown)'}`
        : 'Not found',
    ...(claudeReady
      ? {}
      : {
          hint: claudeExecutable
            ? `Upgrade Claude Code to ${CLAUDE_CODE_MINIMUM_VERSION} or newer, then run: ${SETUP_COMMAND}`
            : `Install Claude Code or set PANERELAY_CLAUDE_PATH, then run: ${SETUP_COMMAND}`,
        }),
  });
  const qoderReady = qoderPath ? await isExecutableFile(qoderPath, platform) : false;
  checks.push({
    id: 'qoder',
    label: 'Qoder CLI (optional)',
    status: qoderReady ? 'pass' : 'warn',
    detail: qoderReady
      ? `${qoderPath}${
          typeof runtimeConfig.qoderVersion === 'string' ? ` (${runtimeConfig.qoderVersion})` : ''
        }`
      : 'Not found',
    ...(qoderReady
      ? {}
      : {
          hint: `Install Qoder CLI or set PANERELAY_QODER_PATH, then run: ${SETUP_COMMAND}`,
        }),
  });
  let agentBrowserStatus: DoctorStatus = 'fail';
  let agentBrowserDetail = agentBrowserPath || 'Not found';
  let agentBrowserHint = `Install agent-browser, then run: ${SETUP_COMMAND}`;
  if (agentBrowserPath && (await isExecutableFile(agentBrowserPath, platform))) {
    try {
      const compatibility = await probeAgentBrowserCompatibility(agentBrowserPath, {
        environment: options.environment,
        platform,
        runner: options.commandRunner,
      });
      agentBrowserStatus = compatibility.supported ? 'pass' : 'fail';
      agentBrowserDetail = `${agentBrowserPath} (${compatibility.version})`;
      agentBrowserHint = `Upgrade agent-browser to ${AGENT_BROWSER_MINIMUM_VERSION} or newer`;
    } catch {
      agentBrowserHint = `Install a working agent-browser ${AGENT_BROWSER_MINIMUM_VERSION} or newer, then run: ${SETUP_COMMAND}`;
    }
  }
  checks.push({
    id: 'agent-browser',
    label: 'agent-browser CLI',
    status: agentBrowserStatus,
    detail: agentBrowserDetail,
    ...(agentBrowserStatus === 'pass' ? {} : { hint: agentBrowserHint }),
  });

  const userConfigPath = userAgentBrowserConfigPath(home);
  let userConfig: Record<string, unknown> = {};
  try {
    userConfig = await readJsonObject(userConfigPath);
  } catch {
    // Report an invalid or missing provider registration below.
  }
  const providerReady = providerPlugin(userConfig, paths.launchPath);
  checks.push({
    id: 'provider',
    label: 'agent-browser Panerelay provider',
    status: providerReady ? 'pass' : 'fail',
    detail: userConfigPath,
    ...(providerReady ? {} : { hint: `Run: ${SETUP_COMMAND}` }),
  });
  if (options.globalProvider) {
    const globalProviderReady = userConfig.provider === 'panerelay';
    checks.push({
      id: 'global-provider',
      label: 'Global default provider',
      status: globalProviderReady ? 'pass' : 'fail',
      detail: globalProviderReady
        ? 'panerelay'
        : typeof userConfig.provider === 'string'
          ? userConfig.provider
          : 'Not configured',
      ...(globalProviderReady ? {} : { hint: `Run: ${SETUP_COMMAND} --global-provider` }),
    });
  }
  const skillPath = globalSkillPath(home);
  const skillReady = await exists(join(skillPath, 'SKILL.md'));
  checks.push({
    id: 'skill',
    label: 'Panerelay Agent Skill',
    status: skillReady ? 'pass' : 'fail',
    detail: skillPath,
    ...(skillReady ? {} : { hint: `Run: ${SETUP_COMMAND}` }),
  });

  let bridgeStatus: DoctorStatus = 'warn';
  let bridgeDetail = 'Extension is not currently connected';
  const registryOptions = {
    environment: options.environment,
    legacyPath: join(home, '.panerelay', 'bridge.json'),
    registryDirectory: join(home, '.panerelay', 'browsers'),
  };
  const registrations = await listBrowserRegistrations(registryOptions);
  const liveStates =
    registrations.length > 0
      ? registrations.map(registration => registration.state)
      : [await readLiveLegacyBrowserRegistration(registryOptions)].filter(state => state !== null);
  if (liveStates.some(state => state.extensionId !== extensionId)) {
    bridgeStatus = 'fail';
    bridgeDetail = 'Connected Extension ID does not match the effective Extension ID';
  } else if (liveStates.length > 0) {
    bridgeStatus = 'pass';
    bridgeDetail =
      liveStates.length === 1
        ? `Connected through process ${liveStates[0]!.pid}`
        : `Connected through ${liveStates.length} browser processes`;
  }
  checks.push({
    id: 'extension',
    label: 'Panerelay Extension connection',
    status: bridgeStatus,
    detail: bridgeDetail,
    ...(bridgeStatus === 'pass'
      ? {}
      : { hint: 'Load or reload the extension, then open its side panel' }),
  });

  if (options.project) {
    const projectDirectory = options.projectDirectory ?? process.cwd();
    const projectConfigPath = projectAgentBrowserConfigPath(projectDirectory);
    let projectConfig: Record<string, unknown> = {};
    try {
      projectConfig = await readJsonObject(projectConfigPath);
    } catch {
      // Report the missing project integration below.
    }
    const projectConfigured = projectConfig.provider === 'panerelay';
    checks.push({
      id: 'project-provider',
      label: 'Project default provider',
      status: projectConfigured ? 'pass' : 'fail',
      detail: projectConfigPath,
      ...(projectConfigured ? {} : { hint: `Run: ${SETUP_COMMAND} --project-provider` }),
    });
    const installedProjectSkillPath = projectSkillPath(projectDirectory);
    const projectSkillReady = await exists(join(installedProjectSkillPath, 'SKILL.md'));
    checks.push({
      id: 'project-skill',
      label: 'Project Panerelay Skill',
      status: projectSkillReady ? 'pass' : 'fail',
      detail: installedProjectSkillPath,
      ...(projectSkillReady ? {} : { hint: `Run: ${SETUP_COMMAND} --project-provider` }),
    });
  }

  return {
    checks,
    ok: checks.every(check => check.status !== 'fail'),
  };
}
