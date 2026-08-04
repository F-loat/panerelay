import {
  readCliAdapterPreferences,
  readCliAdapterRegistry,
  type CliAdapterPreferences,
  type CliAdapterRegistry,
} from '@panerelay/cli/adapter-config';
import {
  readAgentBrowserIntegrationState,
  type UserAgentBrowserIntegrationState,
} from './agent-browser-config.js';

export interface BrowserAutomationSetupHint {
  agentBrowser?: {
    registered: true;
    isDefault: boolean;
  };
  browserUse?: {
    registered: true;
    mode?: 'direct' | 'extension';
  };
  playwright?: {
    registered: true;
  };
}

export interface BrowserAutomationSetupHintDependencies {
  readAgentBrowserState?: () => Promise<UserAgentBrowserIntegrationState>;
  readAdapterRegistry?: () => Promise<CliAdapterRegistry>;
  readAdapterPreferences?: () => Promise<CliAdapterPreferences>;
}

function fulfilled<T>(result: PromiseSettledResult<T>): T | undefined {
  return result.status === 'fulfilled' ? result.value : undefined;
}

export async function readBrowserAutomationSetupHint(
  dependencies: BrowserAutomationSetupHintDependencies = {},
): Promise<BrowserAutomationSetupHint | undefined> {
  const [agentBrowserResult, registryResult, preferencesResult] = await Promise.allSettled([
    (dependencies.readAgentBrowserState ?? readAgentBrowserIntegrationState)(),
    (dependencies.readAdapterRegistry ?? readCliAdapterRegistry)(),
    (dependencies.readAdapterPreferences ?? readCliAdapterPreferences)(),
  ]);
  const agentBrowser = fulfilled(agentBrowserResult);
  const registry = fulfilled(registryResult);
  const preferences = fulfilled(preferencesResult);
  const browserUseRegistered = registry?.adapters.some(
    adapter => adapter.adapterId === 'browser-use',
  );
  const playwrightRegistered = registry?.adapters.some(
    adapter => adapter.adapterId === 'playwright',
  );
  const browserUseMode = preferences?.modes['browser-use'];
  const hint: BrowserAutomationSetupHint = {
    ...(agentBrowser?.providerAvailable
      ? {
          agentBrowser: {
            registered: true as const,
            isDefault: agentBrowser.isPanerelayDefault,
          },
        }
      : {}),
    ...(browserUseRegistered
      ? {
          browserUse: {
            registered: true as const,
            ...(browserUseMode === 'direct' || browserUseMode === 'extension'
              ? { mode: browserUseMode }
              : {}),
          },
        }
      : {}),
    ...(playwrightRegistered ? { playwright: { registered: true as const } } : {}),
  };
  return hint.agentBrowser || hint.browserUse || hint.playwright ? hint : undefined;
}
