import { readFile } from 'node:fs/promises';
import { agentBrowserConfigPath, runtimeConfigPath } from '@panerelay/protocol/node';
import { isExecutableFile } from './platform.js';
import { probeAgentBrowserCompatibility } from './compatibility.js';

export interface PaneRelayRuntimeConfig {
  extensionId?: string;
  codexPath?: string;
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

export async function readRuntimeConfig(): Promise<PaneRelayRuntimeConfig> {
  let stored: Partial<PaneRelayRuntimeConfig> = {};
  try {
    stored = JSON.parse(
      await readFile(runtimeConfigPath(), 'utf8'),
    ) as Partial<PaneRelayRuntimeConfig>;
  } catch {
    // Missing runtime discovery is reported as provider setup guidance.
  }

  const configuredCodex = process.env.PANERELAY_CODEX_PATH || stored.codexPath;
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
    ...((await executable(configuredCodex)) ? { codexPath: configuredCodex } : {}),
    ...supportedAgentBrowser,
    ...((await executable(configuredQoder)) ? { qoderPath: configuredQoder } : {}),
    ...(typeof stored.qoderVersion === 'string' ? { qoderVersion: stored.qoderVersion } : {}),
    agentBrowserConfigPath: stored.agentBrowserConfigPath || agentBrowserConfigPath(),
  };
}
