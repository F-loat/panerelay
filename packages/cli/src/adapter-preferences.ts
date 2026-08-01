import { randomBytes } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CliAdapterMode } from '@panerelay/protocol';

export const PANERELAY_CLI_ADAPTER_PREFERENCES_VERSION =
  'panerelay.cli-adapter-preferences.v1' as const;
export const PANERELAY_CLI_ADAPTER_PREFERENCES_PATH_ENV =
  'PANERELAY_CLI_ADAPTER_PREFERENCES_PATH' as const;

export interface CliAdapterPreferences {
  protocol: typeof PANERELAY_CLI_ADAPTER_PREFERENCES_VERSION;
  modes: Record<string, CliAdapterMode>;
}

export interface CliAdapterPreferenceOptions {
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  preferencesPath?: string;
}

export function cliAdapterPreferencesPath(options: CliAdapterPreferenceOptions = {}): string {
  return (
    options.preferencesPath ??
    options.environment?.[PANERELAY_CLI_ADAPTER_PREFERENCES_PATH_ENV] ??
    join(options.homeDirectory ?? homedir(), '.panerelay', 'cli-adapter-preferences.json')
  );
}

function isAdapterId(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,63}$/.test(value);
}

function isPreferences(value: unknown): value is CliAdapterPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).length !== 2 ||
    candidate.protocol !== PANERELAY_CLI_ADAPTER_PREFERENCES_VERSION ||
    !candidate.modes ||
    typeof candidate.modes !== 'object' ||
    Array.isArray(candidate.modes)
  ) {
    return false;
  }
  const entries = Object.entries(candidate.modes as Record<string, unknown>);
  return (
    entries.length <= 32 &&
    entries.every(
      ([adapterId, mode]) => isAdapterId(adapterId) && (mode === 'direct' || mode === 'extension'),
    )
  );
}

async function assertProtectedFile(filePath: string): Promise<void> {
  const directoryMetadata = await lstat(dirname(filePath));
  if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
    throw new Error('Panerelay CLI adapter preferences directory is not protected');
  }
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error('Panerelay CLI adapter preferences are not a protected regular file');
  }
  if (
    process.platform !== 'win32' &&
    ((directoryMetadata.mode & 0o077) !== 0 || (metadata.mode & 0o077) !== 0)
  ) {
    throw new Error('Panerelay CLI adapter preferences permissions are too broad');
  }
}

export async function readCliAdapterPreferences(
  options: CliAdapterPreferenceOptions = {},
): Promise<CliAdapterPreferences> {
  const filePath = cliAdapterPreferencesPath(options);
  try {
    await assertProtectedFile(filePath);
    const value = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
    if (!isPreferences(value)) throw new Error('Panerelay CLI adapter preferences are invalid');
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { protocol: PANERELAY_CLI_ADAPTER_PREFERENCES_VERSION, modes: {} };
    }
    throw error;
  }
}

async function writeCliAdapterPreferences(
  preferences: CliAdapterPreferences,
  options: CliAdapterPreferenceOptions,
): Promise<void> {
  if (!isPreferences(preferences)) {
    throw new Error('Panerelay CLI adapter preferences are invalid');
  }
  const filePath = cliAdapterPreferencesPath(options);
  const directory = dirname(filePath);
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await chmod(directory, 0o700);
  await writeFile(temporaryPath, `${JSON.stringify(preferences, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, filePath);
  if (process.platform !== 'win32') await chmod(filePath, 0o600);
}

export async function readCliAdapterMode(
  adapterId: string,
  options: CliAdapterPreferenceOptions = {},
): Promise<CliAdapterMode | null> {
  if (!isAdapterId(adapterId)) throw new Error('Panerelay CLI adapter ID is invalid');
  return (await readCliAdapterPreferences(options)).modes[adapterId] ?? null;
}

export async function setCliAdapterMode(
  adapterId: string,
  mode: CliAdapterMode,
  options: CliAdapterPreferenceOptions = {},
): Promise<void> {
  if (!isAdapterId(adapterId) || (mode !== 'direct' && mode !== 'extension')) {
    throw new Error('Panerelay CLI adapter mode is invalid');
  }
  const preferences = await readCliAdapterPreferences(options);
  await writeCliAdapterPreferences(
    { ...preferences, modes: { ...preferences.modes, [adapterId]: mode } },
    options,
  );
}

export async function removeCliAdapterMode(
  adapterId: string,
  options: CliAdapterPreferenceOptions = {},
): Promise<void> {
  if (!isAdapterId(adapterId)) throw new Error('Panerelay CLI adapter ID is invalid');
  const preferences = await readCliAdapterPreferences(options);
  if (!(adapterId in preferences.modes)) return;
  const modes = { ...preferences.modes };
  delete modes[adapterId];
  await writeCliAdapterPreferences({ ...preferences, modes }, options);
}
