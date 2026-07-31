import { readFile } from 'node:fs/promises';
import { agentBrowserConfigPath, runtimeConfigPath } from '@panerelay/protocol/node';
import { isExecutableFile } from './platform.js';
import { probeAgentBrowserCompatibility } from './compatibility.js';

export interface PanerelayRuntimeConfig {
  extensionId?: string;
  firefoxExtensionId?: string;
  firefoxPath?: string;
  firefoxVersion?: string;
  firefoxProfile?: string;
  geckodriverPath?: string;
  geckodriverVersion?: string;
  firefoxManagedToken?: string;
  firefoxMarionettePort?: number;
  firefoxRuntimeStatePath?: string;
  firefoxLauncherPath?: string;
  codexPath?: string;
  claudePath?: string;
  claudeVersion?: string;
  agentBrowserPath?: string;
  agentBrowserVersion?: string;
  agentBrowserConfigPath: string;
  qoderPath?: string;
  qoderVersion?: string;
}

async function executable(path: string | undefined): Promise<boolean> {
  if (!path) return false;
  return isExecutableFile(path);
}

export async function readRuntimeConfig(): Promise<PanerelayRuntimeConfig> {
  let stored: Partial<PanerelayRuntimeConfig> = {};
  try {
    stored = JSON.parse(
      await readFile(runtimeConfigPath(), 'utf8'),
    ) as Partial<PanerelayRuntimeConfig>;
  } catch {
    // Missing runtime discovery is reported as provider setup guidance.
  }

  const configuredCodex = process.env.PANERELAY_CODEX_PATH || stored.codexPath;
  const configuredClaude = process.env.PANERELAY_CLAUDE_PATH || stored.claudePath;
  const configuredAgentBrowser =
    process.env.PANERELAY_AGENT_BROWSER_PATH || stored.agentBrowserPath;
  const configuredQoder = process.env.PANERELAY_QODER_PATH || stored.qoderPath;

  let supportedAgentBrowser: { agentBrowserPath: string; agentBrowserVersion: string } | undefined;
  if (await executable(configuredAgentBrowser)) {
    try {
      const compatibility = await probeAgentBrowserCompatibility(configuredAgentBrowser!);
      if (compatibility.supported) {
        supportedAgentBrowser = {
          agentBrowserPath: configuredAgentBrowser!,
          agentBrowserVersion: compatibility.version,
        };
      }
    } catch {
      // Unsupported or unprobeable runtimes stay unavailable to Agent adapters.
    }
  }

  return {
    ...(typeof stored.extensionId === 'string' ? { extensionId: stored.extensionId } : {}),
    ...(typeof stored.firefoxExtensionId === 'string'
      ? { firefoxExtensionId: stored.firefoxExtensionId }
      : {}),
    ...(typeof stored.firefoxPath === 'string' ? { firefoxPath: stored.firefoxPath } : {}),
    ...(typeof stored.firefoxVersion === 'string' ? { firefoxVersion: stored.firefoxVersion } : {}),
    ...(typeof stored.firefoxProfile === 'string' ? { firefoxProfile: stored.firefoxProfile } : {}),
    ...(typeof stored.geckodriverPath === 'string'
      ? { geckodriverPath: stored.geckodriverPath }
      : {}),
    ...(typeof stored.geckodriverVersion === 'string'
      ? { geckodriverVersion: stored.geckodriverVersion }
      : {}),
    ...(typeof stored.firefoxManagedToken === 'string'
      ? { firefoxManagedToken: stored.firefoxManagedToken }
      : {}),
    ...(typeof stored.firefoxMarionettePort === 'number'
      ? { firefoxMarionettePort: stored.firefoxMarionettePort }
      : {}),
    ...(typeof stored.firefoxRuntimeStatePath === 'string'
      ? { firefoxRuntimeStatePath: stored.firefoxRuntimeStatePath }
      : {}),
    ...(typeof stored.firefoxLauncherPath === 'string'
      ? { firefoxLauncherPath: stored.firefoxLauncherPath }
      : {}),
    ...((await executable(configuredCodex)) ? { codexPath: configuredCodex } : {}),
    ...((await executable(configuredClaude)) ? { claudePath: configuredClaude } : {}),
    ...(typeof stored.claudeVersion === 'string' ? { claudeVersion: stored.claudeVersion } : {}),
    ...supportedAgentBrowser,
    ...((await executable(configuredQoder)) ? { qoderPath: configuredQoder } : {}),
    ...(typeof stored.qoderVersion === 'string' ? { qoderVersion: stored.qoderVersion } : {}),
    agentBrowserConfigPath: stored.agentBrowserConfigPath || agentBrowserConfigPath(),
  };
}
