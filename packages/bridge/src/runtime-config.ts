import { readFile } from 'node:fs/promises';
import { runtimeConfigPath } from '@panerelay/protocol/node';
import { isExecutableFile, normalizeExecutablePathEntries } from './platform.js';

export interface PanerelayRuntimeConfig {
  extensionId?: string;
  agentPathEntries?: string[];
  codexPath?: string;
  claudePath?: string;
  claudeVersion?: string;
  qoderPath?: string;
  qoderVersion?: string;
  opencodePath?: string;
  opencodePathSource?: OpenCodePathSource;
  opencodeVersion?: string;
}

export type OpenCodePathSource = 'discovered' | 'override';

export interface RuntimeConfigReadOptions {
  environment?: NodeJS.ProcessEnv;
  path?: string;
}

export function normalizeOpenCodePathSource(value: unknown): OpenCodePathSource {
  return value === 'override' ? 'override' : 'discovered';
}

async function executable(path: string | undefined): Promise<boolean> {
  if (!path) return false;
  return isExecutableFile(path);
}

export async function readRuntimeConfig(
  options: RuntimeConfigReadOptions = {},
): Promise<PanerelayRuntimeConfig> {
  const environment = options.environment ?? process.env;
  let stored: Partial<PanerelayRuntimeConfig> = {};
  try {
    stored = JSON.parse(
      await readFile(options.path ?? runtimeConfigPath(), 'utf8'),
    ) as Partial<PanerelayRuntimeConfig>;
  } catch {
    // Missing runtime discovery is reported as provider setup guidance.
  }

  const configuredCodex = process.env.PANERELAY_CODEX_PATH || stored.codexPath;
  const configuredClaude = process.env.PANERELAY_CLAUDE_PATH || stored.claudePath;
  const configuredQoder = process.env.PANERELAY_QODER_PATH || stored.qoderPath;
  const openCodeOverride = environment.PANERELAY_OPENCODE_PATH;
  const configuredOpenCode = openCodeOverride || stored.opencodePath;
  const openCodePathSource = openCodeOverride
    ? 'override'
    : normalizeOpenCodePathSource(stored.opencodePathSource);
  const agentPathEntries = normalizeExecutablePathEntries(
    Array.isArray(stored.agentPathEntries) ? stored.agentPathEntries : [],
  );

  return {
    ...(typeof stored.extensionId === 'string' ? { extensionId: stored.extensionId } : {}),
    ...(agentPathEntries.length > 0 ? { agentPathEntries } : {}),
    ...((await executable(configuredCodex)) ? { codexPath: configuredCodex } : {}),
    ...((await executable(configuredClaude)) ? { claudePath: configuredClaude } : {}),
    ...(typeof stored.claudeVersion === 'string' ? { claudeVersion: stored.claudeVersion } : {}),
    ...((await executable(configuredQoder)) ? { qoderPath: configuredQoder } : {}),
    ...(typeof stored.qoderVersion === 'string' ? { qoderVersion: stored.qoderVersion } : {}),
    ...((await executable(configuredOpenCode))
      ? { opencodePath: configuredOpenCode, opencodePathSource: openCodePathSource }
      : {}),
    ...(typeof stored.opencodeVersion === 'string'
      ? { opencodeVersion: stored.opencodeVersion }
      : {}),
  };
}
