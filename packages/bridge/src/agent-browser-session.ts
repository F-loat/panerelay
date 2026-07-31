import { PANERELAY_BROWSER_ID_ENV } from '@panerelay/browser-registry';
import { resolveSpawnCommand, runCommand, type CommandRunner } from './platform.js';
import type { PanerelayRuntimeConfig } from './runtime-config.js';

export const AGENT_BROWSER_MCP_NAME = 'panerelay_browser';
export const AGENT_BROWSER_PROVIDER_ID = 'panerelay';
export const AGENT_BROWSER_CLEANUP_TIMEOUT_MS = 5_000;
export const AGENT_BROWSER_SIDEPANEL_INSTRUCTIONS =
  'You are running inside the Panerelay browser side panel. Use the panerelay_browser MCP tools for browser interaction when relevant. Browser authorization is controlled by the user in the side panel; never attempt to widen or bypass it. Keep chat responses concise and surface meaningful browser actions.';

const AGENT_BROWSER_MCP_ARGUMENTS = ['mcp', '--tools', 'core,tabs'] as const;

export interface AgentBrowserSession {
  configPath: string;
  executable: string;
  label: string;
}

export interface CloseAgentBrowserSessionOptions {
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  runner?: CommandRunner;
  timeoutMs?: number;
}

export function createAgentBrowserSession(
  config: PanerelayRuntimeConfig,
  label: string,
): AgentBrowserSession | undefined {
  if (!config.agentBrowserPath || !config.agentBrowserConfigPath) return undefined;
  return {
    configPath: config.agentBrowserConfigPath,
    executable: config.agentBrowserPath,
    label,
  };
}

export function agentBrowserMcpArguments(): string[] {
  return [...AGENT_BROWSER_MCP_ARGUMENTS];
}

export function agentBrowserSessionEnvironment(
  session: AgentBrowserSession,
  browserId?: string,
): Record<string, string> {
  return {
    AGENT_BROWSER_CONFIG: session.configPath,
    AGENT_BROWSER_PROVIDER: AGENT_BROWSER_PROVIDER_ID,
    AGENT_BROWSER_SESSION: session.label,
    ...(browserId ? { [PANERELAY_BROWSER_ID_ENV]: browserId } : {}),
  };
}

export async function closeAgentBrowserSession(
  session: AgentBrowserSession,
  options: CloseAgentBrowserSessionOptions = {},
): Promise<void> {
  const environment: NodeJS.ProcessEnv = {
    ...(options.environment ?? process.env),
    ...agentBrowserSessionEnvironment(session),
  };
  const launch = resolveSpawnCommand(
    session.executable,
    ['--session', session.label, '--provider', AGENT_BROWSER_PROVIDER_ID, 'close'],
    options.platform,
    environment.ComSpec,
  );
  const result = await (options.runner ?? runCommand)(launch.command, launch.args, {
    environment,
    timeoutMs: options.timeoutMs ?? AGENT_BROWSER_CLEANUP_TIMEOUT_MS,
    windowsVerbatimArguments: launch.windowsVerbatimArguments,
  });
  if (result.code !== 0) {
    throw new Error(`agent-browser cleanup exited with code ${result.code}`);
  }
}
