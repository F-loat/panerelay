import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

interface JsonObject {
  [key: string]: unknown;
}

export interface UserAgentBrowserConfigOptions {
  homeDirectory?: string;
}

export interface UserDefaultProviderState {
  path: string;
  provider: string | null;
  isPanerelay: boolean;
}

function asObject(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected a JSON object in ${path}`);
  }
  return value as JsonObject;
}

async function readJsonObject(path: string): Promise<JsonObject> {
  try {
    return asObject(JSON.parse(await readFile(path, 'utf8')), path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function writeJsonObject(path: string, value: JsonObject): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
}

function state(path: string, config: JsonObject): UserDefaultProviderState {
  const provider = typeof config.provider === 'string' ? config.provider : null;
  return {
    path,
    provider,
    isPanerelay: provider === 'panerelay',
  };
}

export function userAgentBrowserConfigPath(homeDirectory = homedir()): string {
  return join(homeDirectory, '.agent-browser', 'config.json');
}

export async function readUserDefaultProvider(
  options: UserAgentBrowserConfigOptions = {},
): Promise<UserDefaultProviderState> {
  const path = userAgentBrowserConfigPath(options.homeDirectory);
  return state(path, await readJsonObject(path));
}

export async function setPanerelayUserDefaultProvider(
  options: UserAgentBrowserConfigOptions = {},
): Promise<UserDefaultProviderState> {
  const path = userAgentBrowserConfigPath(options.homeDirectory);
  const config = await readJsonObject(path);
  config.provider = 'panerelay';
  await writeJsonObject(path, config);
  return state(path, config);
}

export async function clearPanerelayUserDefaultProvider(
  options: UserAgentBrowserConfigOptions = {},
): Promise<UserDefaultProviderState> {
  const path = userAgentBrowserConfigPath(options.homeDirectory);
  const config = await readJsonObject(path);
  if (config.provider !== 'panerelay') return state(path, config);

  delete config.provider;
  if (Object.keys(config).length === 0) await rm(path, { force: true });
  else await writeJsonObject(path, config);
  return state(path, config);
}
