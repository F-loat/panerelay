import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveNativeHostInstallationPaths } from '@panerelay/bridge/install';
import { PANERELAY_EXTENSION_ID, PANERELAY_NATIVE_HOST_NAME } from '@panerelay/protocol';
import {
  projectAgentBrowserConfigPath,
  readJsonObject,
  userAgentBrowserConfigPath,
} from './config.js';
import { globalSkillPath, projectSkillPath } from './skill.js';

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
  globalProvider?: boolean;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  project?: boolean;
  projectDirectory?: string;
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
  hostPath: string,
): Promise<DoctorCheck> {
  for (const manifestPath of manifestPaths) {
    if (!(await exists(manifestPath))) continue;
    try {
      const manifest = await readJsonObject(manifestPath);
      const origins = Array.isArray(manifest.allowed_origins) ? manifest.allowed_origins : [];
      if (
        manifest.name === PANERELAY_NATIVE_HOST_NAME &&
        manifest.path === hostPath &&
        origins.includes(`chrome-extension://${PANERELAY_EXTENSION_ID}/`)
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
    detail: 'No valid PaneRelay manifest was found',
    hint: 'Run: panerelay setup',
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
): Promise<DoctorCheck> {
  const ready = path ? await exists(path, constants.X_OK) : false;
  return {
    id,
    label,
    status: ready ? 'pass' : 'fail',
    detail: path || 'Not found',
    ...(ready ? {} : { hint }),
  };
}

export async function doctorPaneRelay(options: DoctorOptions = {}): Promise<DoctorReport> {
  const home = options.homeDirectory ?? homedir();
  const paths = resolveNativeHostInstallationPaths({
    homeDirectory: home,
    platform: options.platform,
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
  checks.push(
    await executableCheck(
      'native-host',
      'PaneRelay Native Host',
      paths.hostPath,
      'Run: panerelay setup',
    ),
  );
  checks.push(await nativeManifestCheck(paths.manifestPaths, paths.hostPath));

  let runtimeConfig: Record<string, unknown> = {};
  try {
    runtimeConfig = await readJsonObject(paths.runtimeConfigPath);
  } catch {
    // The individual executable checks below provide actionable failures.
  }
  const codexPath =
    typeof runtimeConfig.codexPath === 'string' ? runtimeConfig.codexPath : undefined;
  const agentBrowserPath =
    typeof runtimeConfig.agentBrowserPath === 'string' ? runtimeConfig.agentBrowserPath : undefined;
  checks.push(
    await executableCheck(
      'codex',
      'Codex CLI',
      codexPath,
      'Install Codex CLI, then run: panerelay setup',
    ),
  );
  checks.push(
    await executableCheck(
      'agent-browser',
      'agent-browser CLI',
      agentBrowserPath,
      'Install agent-browser, then run: panerelay setup',
    ),
  );

  const userConfigPath = userAgentBrowserConfigPath(home);
  let userConfig: Record<string, unknown> = {};
  try {
    userConfig = await readJsonObject(userConfigPath);
  } catch {
    // Report an invalid or missing provider registration below.
  }
  const providerReady = providerPlugin(userConfig, paths.hostPath);
  checks.push({
    id: 'provider',
    label: 'agent-browser PaneRelay provider',
    status: providerReady ? 'pass' : 'fail',
    detail: userConfigPath,
    ...(providerReady ? {} : { hint: 'Run: panerelay setup' }),
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
      ...(globalProviderReady ? {} : { hint: 'Run: panerelay setup --global-provider' }),
    });
  }
  const skillPath = globalSkillPath(home);
  const skillReady = await exists(join(skillPath, 'SKILL.md'));
  checks.push({
    id: 'skill',
    label: 'PaneRelay Agent Skill',
    status: skillReady ? 'pass' : 'fail',
    detail: skillPath,
    ...(skillReady ? {} : { hint: 'Run: panerelay setup' }),
  });

  const bridgeStatePath = join(home, '.panerelay', 'bridge.json');
  let bridgeStatus: DoctorStatus = 'warn';
  let bridgeDetail = 'Extension is not currently connected';
  try {
    const state = JSON.parse(await readFile(bridgeStatePath, 'utf8')) as { pid?: unknown };
    if (typeof state.pid === 'number') {
      process.kill(state.pid, 0);
      bridgeStatus = 'pass';
      bridgeDetail = `Connected through process ${state.pid}`;
    }
  } catch {
    // An idle extension is a warning because installation can still be complete.
  }
  checks.push({
    id: 'extension',
    label: 'PaneRelay Extension connection',
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
      ...(projectConfigured ? {} : { hint: 'Run: panerelay setup --project' }),
    });
    const installedProjectSkillPath = projectSkillPath(projectDirectory);
    const projectSkillReady = await exists(join(installedProjectSkillPath, 'SKILL.md'));
    checks.push({
      id: 'project-skill',
      label: 'Project PaneRelay Skill',
      status: projectSkillReady ? 'pass' : 'fail',
      detail: installedProjectSkillPath,
      ...(projectSkillReady ? {} : { hint: 'Run: panerelay setup --project' }),
    });
  }

  return {
    checks,
    ok: checks.every(check => check.status !== 'fail'),
  };
}
