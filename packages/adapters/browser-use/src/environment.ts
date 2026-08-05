import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const PANERELAY_BROWSER_USE_GATEWAY_PATH = '/cdp/browser-use' as const;
export const PANERELAY_BROWSER_USE_GATEWAY_URL =
  `http://127.0.0.1:43827${PANERELAY_BROWSER_USE_GATEWAY_PATH}` as const;

export interface BrowserUseGatewaySelection {
  browserId: string;
  generation: string;
}

function gatewaySelectionToken(selection: BrowserUseGatewaySelection): string {
  return Buffer.from(JSON.stringify(selection), 'utf8').toString('base64url');
}

export function browserUseGatewayUrl(selection?: BrowserUseGatewaySelection): string {
  return selection
    ? `${PANERELAY_BROWSER_USE_GATEWAY_URL}/browser/${gatewaySelectionToken(selection)}`
    : PANERELAY_BROWSER_USE_GATEWAY_URL;
}

export function parseBrowserUseGatewaySelection(
  pathname: string,
): BrowserUseGatewaySelection | null | undefined {
  if (pathname === `${PANERELAY_BROWSER_USE_GATEWAY_PATH}/json/version`) return undefined;
  const prefix = `${PANERELAY_BROWSER_USE_GATEWAY_PATH}/browser/`;
  const suffix = '/json/version';
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
  const token = pathname.slice(prefix.length, -suffix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const value = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const selection = value as Partial<BrowserUseGatewaySelection>;
    if (
      typeof selection.browserId !== 'string' ||
      selection.browserId.length === 0 ||
      selection.browserId.length > 128 ||
      typeof selection.generation !== 'string' ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(selection.generation)
    ) {
      return null;
    }
    return { browserId: selection.browserId, generation: selection.generation };
  } catch {
    return null;
  }
}

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

export function browserUseEnvironmentPath(
  homeDirectory?: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const resolvedHome = homeDirectory ?? environment.HOME ?? environment.USERPROFILE ?? homedir();
  const workspace = environment.BH_AGENT_WORKSPACE?.trim();
  if (workspace) return join(workspace, '.env');
  const configuredHarnessHome =
    environment.BH_HOME?.trim() || environment.BROWSER_HARNESS_HOME?.trim();
  const harnessHome =
    configuredHarnessHome ??
    join(environment.XDG_CONFIG_HOME?.trim() || join(resolvedHome, '.config'), 'browser-harness');
  return join(harnessHome, 'agent-workspace', '.env');
}

function envLine(key: string, value: string): string {
  return `${key}="${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function updateEnvironmentFile(
  mode: 'direct' | 'extension',
  options: BrowserUseEnvironmentOptions,
): Promise<void> {
  const environment = options.environment ?? process.env;
  const path = browserUseEnvironmentPath(options.homeDirectory, environment);
  let existing = '';
  try {
    existing = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const lines = existing.split(/\r?\n/).filter(line => {
    const key = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
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
  const temporary = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
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
