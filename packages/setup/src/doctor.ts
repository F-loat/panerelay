import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  readWindowsNativeHostRegistryValue,
  resolveEffectiveExtensionId,
  resolveEffectiveFirefoxExtensionId,
  resolveNativeHostInstallationPaths,
} from '@panerelay/bridge/install';
import { isExecutableFile, type CommandRunner } from '@panerelay/bridge/platform';
import {
  AGENT_BROWSER_MINIMUM_VERSION,
  probeAgentBrowserCompatibility,
} from '@panerelay/bridge/compatibility';
import {
  PANERELAY_EXTENSION_ID,
  PANERELAY_FIREFOX_EXTENSION_ID,
  PANERELAY_NATIVE_HOST_NAME,
} from '@panerelay/protocol';
import {
  projectAgentBrowserConfigPath,
  readJsonObject,
  userAgentBrowserConfigPath,
} from './config.js';
import { globalSkillPath, projectSkillPath } from './skill.js';

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
  environment?: NodeJS.ProcessEnv;
  commandRunner?: CommandRunner;
  extensionId?: string;
  firefoxExtensionId?: string;
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
  options: {
    allowedKey: 'allowed_extensions' | 'allowed_origins';
    allowedValue: string;
    id: string;
    label: string;
  },
): Promise<DoctorCheck> {
  for (const manifestPath of manifestPaths) {
    if (!(await exists(manifestPath))) continue;
    try {
      const manifest = await readJsonObject(manifestPath);
      const rawIdentities = manifest[options.allowedKey];
      const identities: unknown[] = Array.isArray(rawIdentities) ? rawIdentities : [];
      if (
        manifest.name === PANERELAY_NATIVE_HOST_NAME &&
        manifest.path === launchPath &&
        identities.length === 1 &&
        identities[0] === options.allowedValue
      ) {
        return {
          id: options.id,
          label: options.label,
          status: 'pass',
          detail: manifestPath,
        };
      }
    } catch {
      // Continue to report the invalid installation below.
    }
  }
  return {
    id: options.id,
    label: options.label,
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
  let runtimeConfig: Record<string, unknown> = {};
  try {
    runtimeConfig = await readJsonObject(paths.runtimeConfigPath);
  } catch {
    // The individual executable checks below provide actionable failures.
  }
  let extensionId: string = PANERELAY_EXTENSION_ID;
  let firefoxExtensionId: string = PANERELAY_FIREFOX_EXTENSION_ID;
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
  try {
    firefoxExtensionId = resolveEffectiveFirefoxExtensionId({
      environment: options.environment,
      firefoxExtensionId: options.firefoxExtensionId,
      persistedFirefoxExtensionId: runtimeConfig.firefoxExtensionId,
    });
    checks.push({
      id: 'firefox-extension-id',
      label: 'Effective Firefox Extension ID',
      status: 'pass',
      detail: firefoxExtensionId,
    });
  } catch (error) {
    checks.push({
      id: 'firefox-extension-id',
      label: 'Effective Firefox Extension ID',
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error),
      hint: 'Use an email-style Firefox Extension ID of at most 80 characters or a braced UUID',
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
  checks.push(
    await nativeManifestCheck(paths.chromiumManifestPaths, paths.launchPath, {
      allowedKey: 'allowed_origins',
      allowedValue: `chrome-extension://${extensionId}/`,
      id: 'native-manifest',
      label: 'Chromium Native Messaging manifest',
    }),
  );
  checks.push(
    await nativeManifestCheck(paths.firefoxManifestPaths, paths.launchPath, {
      allowedKey: 'allowed_extensions',
      allowedValue: firefoxExtensionId,
      id: 'firefox-native-manifest',
      label: 'Firefox Native Messaging manifest',
    }),
  );
  if (platform === 'win32') {
    for (const browser of ['chrome', 'edge', 'firefox'] as const) {
      const registryValue = await readWindowsNativeHostRegistryValue({
        browser,
        environment: options.environment,
        runner: options.registryRunner,
      });
      const expectedManifestPath =
        browser === 'firefox' ? paths.firefoxManifestPaths[0]! : paths.chromiumManifestPaths[0]!;
      const registryReady = registryValue === expectedManifestPath;
      checks.push({
        id: `windows-registry-${browser}`,
        label: `${browser === 'chrome' ? 'Chrome' : browser === 'edge' ? 'Edge' : 'Firefox'} Native Messaging registry`,
        status: registryReady ? 'pass' : 'fail',
        detail: registryValue || 'Not found',
        ...(registryReady ? {} : { hint: `Run: ${SETUP_COMMAND}` }),
      });
    }
  }
  const codexPath =
    typeof runtimeConfig.codexPath === 'string' ? runtimeConfig.codexPath : undefined;
  const agentBrowserPath =
    typeof runtimeConfig.agentBrowserPath === 'string' ? runtimeConfig.agentBrowserPath : undefined;
  const qoderPath =
    typeof runtimeConfig.qoderPath === 'string' ? runtimeConfig.qoderPath : undefined;
  const firefoxPath =
    typeof runtimeConfig.firefoxPath === 'string' ? runtimeConfig.firefoxPath : undefined;
  const geckodriverPath =
    typeof runtimeConfig.geckodriverPath === 'string' ? runtimeConfig.geckodriverPath : undefined;
  checks.push(
    await executableCheck(
      'codex',
      'Codex CLI',
      codexPath,
      `Install Codex CLI, then run: ${SETUP_COMMAND}`,
      platform,
    ),
  );
  const firefoxReady = firefoxPath ? await isExecutableFile(firefoxPath, platform) : false;
  checks.push({
    id: 'firefox-runtime',
    label: 'Firefox automation browser (optional)',
    status: firefoxReady ? 'pass' : 'warn',
    detail: firefoxReady
      ? `${firefoxPath}${
          typeof runtimeConfig.firefoxVersion === 'string'
            ? ` (${runtimeConfig.firefoxVersion})`
            : ''
        }`
      : 'Not found',
    ...(firefoxReady
      ? {}
      : {
          hint: `Install Firefox or set PANERELAY_FIREFOX_PATH, then run: ${SETUP_COMMAND}`,
        }),
  });
  const geckodriverReady = geckodriverPath
    ? await isExecutableFile(geckodriverPath, platform)
    : false;
  checks.push({
    id: 'geckodriver',
    label: 'geckodriver (optional)',
    status: geckodriverReady ? 'pass' : 'warn',
    detail: geckodriverReady
      ? `${geckodriverPath}${
          typeof runtimeConfig.geckodriverVersion === 'string'
            ? ` (${runtimeConfig.geckodriverVersion})`
            : ''
        }`
      : 'Not found',
    ...(geckodriverReady
      ? {}
      : {
          hint: `Install geckodriver or set PANERELAY_GECKODRIVER_PATH, then run: ${SETUP_COMMAND}`,
        }),
  });
  const firefoxLauncherReady =
    firefoxReady &&
    geckodriverReady &&
    (await isExecutableFile(paths.firefoxLauncherPath, platform));
  checks.push({
    id: 'firefox-launcher',
    label: 'Panerelay Firefox automation launcher (optional)',
    status: firefoxLauncherReady ? 'pass' : 'warn',
    detail: firefoxLauncherReady ? paths.firefoxLauncherPath : 'Not ready',
    ...(firefoxLauncherReady
      ? {}
      : {
          hint: 'Install Firefox and geckodriver, run setup, then start Firefox with the Panerelay launcher',
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

  const bridgeStatePath = join(home, '.panerelay', 'bridge.json');
  let bridgeStatus: DoctorStatus = 'warn';
  let bridgeDetail = 'Extension is not currently connected';
  try {
    const state = JSON.parse(await readFile(bridgeStatePath, 'utf8')) as {
      extensionId?: unknown;
      pid?: unknown;
    };
    if (typeof state.pid === 'number') {
      process.kill(state.pid, 0);
      if (state.extensionId === extensionId || state.extensionId === firefoxExtensionId) {
        bridgeStatus = 'pass';
        bridgeDetail = `Connected through process ${state.pid}`;
      } else {
        bridgeStatus = 'fail';
        bridgeDetail = 'Connected Extension ID does not match the effective Extension ID';
      }
    }
  } catch {
    // An idle extension is a warning because installation can still be complete.
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
