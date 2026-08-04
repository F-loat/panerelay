import { homedir } from 'node:os';
import { readAgentBrowserIntegrationState } from '@panerelay/bridge/agent-browser-config';
import { readCliAdapterMode, readCliAdapterRegistration } from '@panerelay/cli';

export type SetupIntegration = 'agentBrowser' | 'browserUse' | 'playwright';
export type DefaultSetupIntegration = Exclude<SetupIntegration, 'playwright'>;

export interface InteractiveSetupState {
  defaultIntegrations: DefaultSetupIntegration[];
  globalDefault: boolean;
  integrations: SetupIntegration[];
}

export interface InteractiveSetupStateOptions {
  dataDirectory?: string;
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
}

export interface InteractiveSetupStateDependencies {
  readAdapterMode?: typeof readCliAdapterMode;
  readAdapterRegistration?: typeof readCliAdapterRegistration;
  readAgentBrowserState?: typeof readAgentBrowserIntegrationState;
}

function resolveHomeDirectory(options: InteractiveSetupStateOptions): string {
  return (
    options.homeDirectory ??
    options.environment?.HOME ??
    options.environment?.USERPROFILE ??
    homedir()
  );
}

function settledValue<T>(result: PromiseSettledResult<T>): T | undefined {
  return result.status === 'fulfilled' ? result.value : undefined;
}

export async function readInteractiveSetupState(
  options: InteractiveSetupStateOptions = {},
  dependencies: InteractiveSetupStateDependencies = {},
): Promise<InteractiveSetupState> {
  const homeDirectory = resolveHomeDirectory(options);
  const adapterOptions = {
    dataDirectory: options.dataDirectory,
    environment: options.environment,
    homeDirectory,
    platform: options.platform,
  };
  const [agentBrowser, browserUse, playwright, browserUseMode] = await Promise.allSettled([
    (dependencies.readAgentBrowserState ?? readAgentBrowserIntegrationState)({ homeDirectory }),
    (dependencies.readAdapterRegistration ?? readCliAdapterRegistration)(
      'browser-use',
      adapterOptions,
    ),
    (dependencies.readAdapterRegistration ?? readCliAdapterRegistration)(
      'playwright',
      adapterOptions,
    ),
    (dependencies.readAdapterMode ?? readCliAdapterMode)('browser-use', {
      environment: options.environment,
      homeDirectory,
    }),
  ]);

  const agentBrowserState = settledValue(agentBrowser);
  const browserUseRegistration = settledValue(browserUse);
  const playwrightRegistration = settledValue(playwright);
  const integrations: SetupIntegration[] = [
    ...(agentBrowserState?.providerAvailable ? (['agentBrowser'] as const) : []),
    ...(browserUseRegistration ? (['browserUse'] as const) : []),
    ...(playwrightRegistration ? (['playwright'] as const) : []),
  ];
  const defaultStates = [
    ...(integrations.includes('agentBrowser')
      ? [agentBrowserState?.isPanerelayDefault === true]
      : []),
    ...(integrations.includes('browserUse') ? [settledValue(browserUseMode) === 'extension'] : []),
  ];
  const defaultIntegrations: DefaultSetupIntegration[] = [
    ...(integrations.includes('agentBrowser') && agentBrowserState?.isPanerelayDefault === true
      ? (['agentBrowser'] as const)
      : []),
    ...(integrations.includes('browserUse') && settledValue(browserUseMode) === 'extension'
      ? (['browserUse'] as const)
      : []),
  ];
  return {
    defaultIntegrations,
    globalDefault: defaultStates.length > 0 && defaultStates.every(Boolean),
    integrations,
  };
}
