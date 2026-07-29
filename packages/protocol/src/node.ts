import { homedir } from 'node:os';
import { join } from 'node:path';

export const PANERELAY_STATE_PATH_ENV = 'PANERELAY_STATE_PATH' as const;

export function panerelayDataDirectory(): string {
  return join(homedir(), '.panerelay');
}

export function bridgeStatePath(): string {
  return process.env[PANERELAY_STATE_PATH_ENV] || join(panerelayDataDirectory(), 'bridge.json');
}

export function runtimeConfigPath(): string {
  return join(panerelayDataDirectory(), 'runtime.json');
}

export function agentBrowserConfigPath(): string {
  return join(panerelayDataDirectory(), 'agent-browser.json');
}
