import { dirname } from 'node:path';
import type { AutomationIntegrationId } from '@panerelay/protocol';
import {
  resolveExecutablePath,
  resolveSpawnCommand,
  runCommand,
  type CommandRunner,
} from './platform.js';

export const INTEGRATION_INSTALL_TIMEOUT_MS = 5 * 60_000;

const SETUP_FLAGS: Record<AutomationIntegrationId, string> = {
  'agent-browser': '--agent-browser',
  'browser-use': '--browser-use',
};
const EXACT_PACKAGE_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export interface IntegrationSetupCommand {
  args: string[];
  manualCommand: string;
  packageSpec: string;
}

export interface InstallAutomationIntegrationOptions {
  environment?: NodeJS.ProcessEnv;
  nodePath?: string;
  packageRunner?: string;
  platform?: NodeJS.Platform;
  runner?: CommandRunner;
  timeoutMs?: number;
}

function integrationFlag(integration: AutomationIntegrationId): string {
  const flag = SETUP_FLAGS[integration];
  if (!flag) throw new Error('Unsupported Panerelay integration installation request');
  return flag;
}

export function integrationSetupCommand(
  integration: AutomationIntegrationId,
  version: string,
): IntegrationSetupCommand {
  if (!EXACT_PACKAGE_VERSION.test(version)) {
    throw new Error('The connected Panerelay Extension version cannot select a setup package');
  }
  const flag = integrationFlag(integration);
  const packageSpec = `@panerelay/setup@${version}`;
  return {
    args: ['--yes', packageSpec, flag],
    manualCommand: `npx --yes @panerelay/setup ${flag}`,
    packageSpec,
  };
}

export async function installAutomationIntegration(
  integration: AutomationIntegrationId,
  version: string,
  options: InstallAutomationIntegrationOptions = {},
): Promise<void> {
  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const command = integrationSetupCommand(integration, version);
  const packageRunner =
    options.packageRunner ??
    (await resolveExecutablePath('npx', {
      environment,
      extraDirectories: [dirname(options.nodePath ?? process.execPath)],
      platform,
    }));
  if (!packageRunner) {
    throw new Error(`The package runner is unavailable. Run ${command.manualCommand}`);
  }
  const launch = resolveSpawnCommand(packageRunner, command.args, platform, environment.ComSpec);
  const result = await (options.runner ?? runCommand)(launch.command, launch.args, {
    environment,
    timeoutMs: options.timeoutMs ?? INTEGRATION_INSTALL_TIMEOUT_MS,
    windowsVerbatimArguments: launch.windowsVerbatimArguments,
  });
  if (result.code !== 0) {
    throw new Error(`Panerelay integration setup did not complete. Run ${command.manualCommand}`);
  }
}
