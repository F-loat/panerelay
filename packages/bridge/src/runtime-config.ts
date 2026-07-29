import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { agentBrowserConfigPath, runtimeConfigPath } from '@panerelay/protocol/node';

export interface PaneRelayRuntimeConfig {
  codexPath?: string;
  agentBrowserPath?: string;
  agentBrowserConfigPath: string;
}

async function executable(path: string | undefined): Promise<boolean> {
  if (!path) return false;
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
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

  return {
    ...((await executable(configuredCodex)) ? { codexPath: configuredCodex } : {}),
    ...((await executable(configuredAgentBrowser))
      ? { agentBrowserPath: configuredAgentBrowser }
      : {}),
    agentBrowserConfigPath: stored.agentBrowserConfigPath || agentBrowserConfigPath(),
  };
}
