import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
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
} from '@panerelay/bridge/compatibility';
import { PANERELAY_EXTENSION_ID, PANERELAY_NATIVE_HOST_NAME } from '@panerelay/protocol';
import {
  listBrowserRegistrations,
  readLiveLegacyBrowserRegistration,
} from '@panerelay/browser-registry';
import {
  BROWSER_USE_MINIMUM_VERSION,
  PANERELAY_BROWSER_USE_GATEWAY_URL,
  browserUseInstallationStatus,
  browserUseEnvironmentPath,
  probeBrowserUseVersions,
} from '@panerelay/browser-use';
import { readCliAdapterMode } from '@panerelay/cli/adapter-config';
import { readJsonObject, userAgentBrowserConfigPath } from './config.js';
import { globalSkillPath } from './skill.js';
import { probeAgentBrowserInstallation } from './agent-browser-integration.js';
import { PLAYWRIGHT_MINIMUM_VERSION, probePlaywrightInstallation } from '@panerelay/playwright';

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
  agentBrowser?: boolean;
  agentBrowserProbe?: typeof probeAgentBrowserInstallation;
  browserUse?: boolean;
  playwright?: boolean;
  playwrightProbe?: typeof probePlaywrightInstallation;
  browserUseProbe?: typeof probeBrowserUseVersions;
  browserUseGatewayProbe?: () => Promise<boolean>;
  environment?: NodeJS.ProcessEnv;
  commandRunner?: CommandRunner;
  extensionId?: string;
  globalDefault?: boolean;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  registryRunner?: CommandRunner;
}

async function probeBrowserUseGateway(): Promise<boolean> {
  try {
    const gateway = new URL(PANERELAY_BROWSER_USE_GATEWAY_URL);
    const response = await fetch(`${gateway.origin}/health`, {
      signal: AbortSignal.timeout(500),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { pid?: unknown; protocol?: unknown; ready?: unknown };
    return (
      body.protocol === 'panerelay.browser-use-gateway.v1' &&
      body.ready === true &&
      typeof body.pid === 'number' &&
      Number.isSafeInteger(body.pid) &&
      body.pid > 0
    );
  } catch {
    return false;
  }
}

async function readBrowserUseEnvironment(path: string): Promise<Map<string, string>> {
  const values = new Map<string, string>();
  try {
    const content = await readFile(path, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      let value = match[2] ?? '';
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }
      values.set(match[1]!, value);
    }
  } catch {
    // The caller reports a missing or unreadable managed environment.
  }
  return values;
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
  if (!options.agentBrowser && options.globalDefault && !options.browserUse) {
    checks.push({
      id: 'global-default-selection',
      label: 'Global default selection',
      status: 'fail',
      detail: 'globalDefault requires agentBrowser or browserUse',
      hint: `Run: ${SETUP_COMMAND} doctor --agent-browser --global-default or --browser-use --global-default`,
    });
  }
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] || '0', 10);
  checks.push({
    id: 'node',
    label: 'Node.js',
    status: nodeMajor >= 20 ? 'pass' : 'fail',
    detail: process.version,
    ...(nodeMajor >= 20 ? {} : { hint: 'Install Node.js 20 or newer' }),
  });
  const diagnoseBrowserUse = options.browserUse === true;
  let browserUseMode: 'direct' | 'extension' | null = null;
  let browserUseEnvironmentReady: boolean | null = null;
  let browserUseGatewayReady: boolean | null = null;
  if (diagnoseBrowserUse) {
    browserUseMode = await readCliAdapterMode('browser-use', { homeDirectory: home });
    const versions = await (options.browserUseProbe ?? probeBrowserUseVersions)(
      options.environment,
      platform,
    );
    const installationStatus = browserUseInstallationStatus(versions);
    const browserUseReady = installationStatus === 'ready';
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
            hint:
              installationStatus === 'not-found'
                ? `Install Browser Use ${BROWSER_USE_MINIMUM_VERSION} or newer, then run: ${SETUP_COMMAND} --browser-use`
                : `Repair or upgrade Browser Use to ${BROWSER_USE_MINIMUM_VERSION} or newer, then run: ${SETUP_COMMAND} doctor --browser-use`,
          }),
    });
  }
  if (diagnoseBrowserUse && browserUseMode === 'extension') {
    const environmentPath = browserUseEnvironmentPath(home, options.environment);
    const managedEnvironment = await readBrowserUseEnvironment(environmentPath);
    const processEnvironment = options.environment ?? process.env;
    const processGatewayUrl = processEnvironment.BU_CDP_URL?.trim();
    const hasWebSocketOverride = [
      processEnvironment.BU_CDP_WS,
      managedEnvironment.get('BU_CDP_WS'),
    ].some(value => Boolean(value?.trim()));
    const environmentReady =
      managedEnvironment.get('BU_CDP_URL') === PANERELAY_BROWSER_USE_GATEWAY_URL &&
      !hasWebSocketOverride &&
      (!processGatewayUrl || processGatewayUrl === PANERELAY_BROWSER_USE_GATEWAY_URL);
    browserUseEnvironmentReady = environmentReady;
    checks.push({
      id: 'browser-use-environment',
      label: 'Browser Use Extension environment',
      status: environmentReady ? 'pass' : 'fail',
      detail: environmentReady ? environmentPath : 'Managed Browser Use environment is invalid',
      ...(environmentReady ? {} : { hint: `Run: ${SETUP_COMMAND} --browser-use --global-default` }),
    });
    const gatewayReady = await (options.browserUseGatewayProbe ?? probeBrowserUseGateway)();
    browserUseGatewayReady = gatewayReady;
    checks.push({
      id: 'browser-use-gateway',
      label: 'Browser Use gateway',
      status: gatewayReady ? 'pass' : 'fail',
      detail: gatewayReady ? PANERELAY_BROWSER_USE_GATEWAY_URL : 'Gateway is unavailable',
      ...(gatewayReady
        ? {}
        : { hint: 'Open the Panerelay side panel and reconnect the Extension' }),
    });
  }
  if (options.playwright) {
    const installation = await (options.playwrightProbe ?? probePlaywrightInstallation)(
      options.environment,
      platform,
    );
    checks.push({
      id: 'playwright',
      label: 'Playwright CLI',
      status: installation.supported ? 'pass' : 'fail',
      detail: installation.executable
        ? `${installation.executable}${installation.version ? ` (${installation.version})` : ''}`
        : 'Not found',
      ...(installation.supported
        ? {}
        : {
            hint: installation.executable
              ? `Upgrade Playwright CLI to ${PLAYWRIGHT_MINIMUM_VERSION} or newer, then run: ${SETUP_COMMAND} doctor --playwright`
              : `Install Playwright CLI ${PLAYWRIGHT_MINIMUM_VERSION} or newer, then run: ${SETUP_COMMAND} --playwright`,
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
  if (options.agentBrowser) {
    const installation = await (options.agentBrowserProbe ?? probeAgentBrowserInstallation)({
      environment: options.environment,
      platform,
      runner: options.commandRunner,
    });
    const agentBrowserStatus: DoctorStatus = installation.supported ? 'pass' : 'fail';
    const agentBrowserDetail = installation.executable
      ? `${installation.executable}${installation.version ? ` (${installation.version})` : ''}`
      : 'Not found';
    const agentBrowserHint = installation.executable
      ? `Upgrade agent-browser to ${AGENT_BROWSER_MINIMUM_VERSION} or newer`
      : `Install a working agent-browser ${AGENT_BROWSER_MINIMUM_VERSION} or newer, then run: ${SETUP_COMMAND} --agent-browser`;
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
      ...(providerReady ? {} : { hint: `Run: ${SETUP_COMMAND} --agent-browser` }),
    });
    if (options.globalDefault) {
      const globalDefaultReady = userConfig.provider === 'panerelay';
      checks.push({
        id: 'global-default',
        label: 'agent-browser user default',
        status: globalDefaultReady ? 'pass' : 'fail',
        detail: globalDefaultReady
          ? 'panerelay'
          : typeof userConfig.provider === 'string'
            ? userConfig.provider
            : 'Not configured',
        ...(globalDefaultReady
          ? {}
          : { hint: `Run: ${SETUP_COMMAND} --agent-browser --global-default` }),
      });
    }
    const skillPath = globalSkillPath(home);
    const skillReady = await exists(join(skillPath, 'SKILL.md'));
    checks.push({
      id: 'skill',
      label: 'Panerelay Agent Skill',
      status: skillReady ? 'pass' : 'fail',
      detail: skillPath,
      ...(skillReady ? {} : { hint: `Run: ${SETUP_COMMAND} --agent-browser` }),
    });
  }

  if (options.browserUse && options.globalDefault) {
    const browserUseDefaultReady =
      browserUseMode === 'extension' &&
      browserUseEnvironmentReady === true &&
      browserUseGatewayReady === true;
    checks.push({
      id: 'browser-use-default',
      label: 'Browser Use user default',
      status: browserUseDefaultReady ? 'pass' : 'fail',
      detail: browserUseMode ?? 'Not configured',
      ...(browserUseDefaultReady
        ? {}
        : { hint: `Run: ${SETUP_COMMAND} --browser-use --global-default` }),
    });
  }

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

  return {
    checks,
    ok: checks.every(check => check.status !== 'fail'),
  };
}
