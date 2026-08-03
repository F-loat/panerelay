import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const PANERELAY_BROWSER_USE_GATEWAY_URL = 'http://127.0.0.1:43827/cdp/browser-use' as const;

const managedKeys = new Set([
  'ANONYMIZED_TELEMETRY',
  'BH_RECORD',
  // Legacy path overrides are still removed during an update/uninstall, but
  // must not be written because Browser Harness loads these paths too late.
  'BH_RUNTIME_DIR',
  'BH_RUNTIME_DIR_SHARED',
  'BH_TELEMETRY',
  'BH_TMP_DIR',
  'BH_TMP_DIR_SHARED',
  'BU_CDP_URL',
  'BU_NAME',
]);

export interface BrowserUseEnvironmentOptions {
  homeDirectory?: string;
  environment?: NodeJS.ProcessEnv;
  gatewayUrl?: string;
}

export function browserUseEnvironmentPath(homeDirectory = homedir()): string {
  return join(homeDirectory, '.config', 'browser-harness', 'agent-workspace', '.env');
}

function envLine(key: string, value: string): string {
  return `${key}="${value.replaceAll('"', '\\"')}"`;
}

async function updateEnvironmentFile(
  mode: 'direct' | 'extension',
  options: BrowserUseEnvironmentOptions,
): Promise<void> {
  const homeDirectory = options.homeDirectory ?? homedir();
  const path = browserUseEnvironmentPath(homeDirectory);
  let existing = '';
  try {
    existing = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const lines = existing.split(/\r?\n/).filter(line => {
    const key = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    return !key || !managedKeys.has(key);
  });
  while (lines.at(-1) === '') lines.pop();
  if (mode === 'extension') {
    lines.push(
      envLine('ANONYMIZED_TELEMETRY', 'false'),
      envLine('BH_RECORD', '0'),
      envLine('BH_TELEMETRY', '0'),
      envLine('BU_CDP_URL', options.gatewayUrl ?? PANERELAY_BROWSER_USE_GATEWAY_URL),
      envLine('BU_NAME', 'panerelay'),
    );
  }
  const content = lines.length > 0 ? `${lines.join('\n')}\n` : '';
  if (!content) {
    await rm(path, { force: true });
    return;
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path);
  if (process.platform !== 'win32') await chmod(path, 0o600);
}

export async function setBrowserUseEnvironmentMode(
  mode: 'direct' | 'extension',
  options: BrowserUseEnvironmentOptions = {},
): Promise<void> {
  await updateEnvironmentFile(mode, options);
}
