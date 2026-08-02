import { readFile } from 'node:fs/promises';
import { runtimeConfigPath } from '@panerelay/protocol/node';
import { isExecutableFile } from './platform.js';

export interface PanerelayRuntimeConfig {
  extensionId?: string;
  codexPath?: string;
  claudePath?: string;
  claudeVersion?: string;
  qoderPath?: string;
  qoderVersion?: string;
}

async function executable(path: string | undefined): Promise<boolean> {
  if (!path) return false;
  return isExecutableFile(path);
}

export async function readRuntimeConfig(): Promise<PanerelayRuntimeConfig> {
  let stored: Partial<PanerelayRuntimeConfig> = {};
  try {
    stored = JSON.parse(
      await readFile(runtimeConfigPath(), 'utf8'),
    ) as Partial<PanerelayRuntimeConfig>;
  } catch {
    // Missing runtime discovery is reported as provider setup guidance.
  }

  const configuredCodex = process.env.PANERELAY_CODEX_PATH || stored.codexPath;
  const configuredClaude = process.env.PANERELAY_CLAUDE_PATH || stored.claudePath;
  const configuredQoder = process.env.PANERELAY_QODER_PATH || stored.qoderPath;

  return {
    ...(typeof stored.extensionId === 'string' ? { extensionId: stored.extensionId } : {}),
    ...((await executable(configuredCodex)) ? { codexPath: configuredCodex } : {}),
    ...((await executable(configuredClaude)) ? { claudePath: configuredClaude } : {}),
    ...(typeof stored.claudeVersion === 'string' ? { claudeVersion: stored.claudeVersion } : {}),
    ...((await executable(configuredQoder)) ? { qoderPath: configuredQoder } : {}),
    ...(typeof stored.qoderVersion === 'string' ? { qoderVersion: stored.qoderVersion } : {}),
  };
}
