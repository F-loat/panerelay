import { probeAgentBrowserCompatibility } from '@panerelay/bridge/compatibility';
import { resolveExecutablePath, type CommandRunner } from '@panerelay/bridge/platform';

export interface AgentBrowserInstallation {
  executable?: string;
  supported: boolean;
  version?: string;
}

export interface AgentBrowserProbeOptions {
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  runner?: CommandRunner;
}

export async function probeAgentBrowserInstallation(
  options: AgentBrowserProbeOptions = {},
): Promise<AgentBrowserInstallation> {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const executable = await resolveExecutablePath('agent-browser', {
    configuredPath: environment.PANERELAY_AGENT_BROWSER_PATH,
    environment,
    platform,
  });
  if (!executable) return { supported: false };
  try {
    const compatibility = await probeAgentBrowserCompatibility(executable, {
      environment,
      platform,
      runner: options.runner,
    });
    return {
      executable,
      supported: compatibility.supported,
      version: compatibility.version,
    };
  } catch {
    return { executable, supported: false };
  }
}
