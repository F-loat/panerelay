import { compareVersions, probeExecutableVersion, type CommandRunner } from './platform.js';

export const AGENT_BROWSER_MINIMUM_VERSION = '0.33.0';

export interface AgentBrowserCompatibility {
  supported: boolean;
  version: string;
}

export async function probeAgentBrowserCompatibility(
  executable: string,
  options: {
    environment?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    runner?: CommandRunner;
  } = {},
): Promise<AgentBrowserCompatibility> {
  const version = await probeExecutableVersion(executable, {
    environment: options.environment,
    platform: options.platform,
    runner: options.runner,
  });
  return {
    version,
    supported: compareVersions(version, AGENT_BROWSER_MINIMUM_VERSION) >= 0,
  };
}
