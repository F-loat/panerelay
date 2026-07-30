import { constants } from 'node:fs';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import {
  setPanerelayUserDefaultProvider,
  userAgentBrowserConfigPath,
} from '@panerelay/bridge/agent-browser-config';
import { dirname, join } from 'node:path';

interface JsonObject {
  [key: string]: unknown;
}

export interface ConfigPathOptions {
  homeDirectory?: string;
  projectDirectory?: string;
}

export interface PanerelayPluginConfig {
  name: 'panerelay';
  command: string;
  args: ['--agent-browser-plugin'];
  capabilities: ['browser.provider'];
}

function asObject(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected a JSON object in ${path}`);
  }
  return value as JsonObject;
}

export async function readJsonObject(path: string): Promise<JsonObject> {
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

function emptyObject(value: JsonObject): boolean {
  return Object.keys(value).length === 0;
}

export { userAgentBrowserConfigPath };

export function projectAgentBrowserConfigPath(projectDirectory = process.cwd()): string {
  return join(projectDirectory, 'agent-browser.json');
}

export function panerelayPlugin(hostPath: string): PanerelayPluginConfig {
  return {
    name: 'panerelay',
    command: hostPath,
    args: ['--agent-browser-plugin'],
    capabilities: ['browser.provider'],
  };
}

export async function registerPanerelayProvider(
  hostPath: string,
  options: ConfigPathOptions = {},
): Promise<string> {
  const path = userAgentBrowserConfigPath(options.homeDirectory);
  const config = await readJsonObject(path);
  const plugins = Array.isArray(config.plugins) ? config.plugins : [];
  config.plugins = [
    ...plugins.filter(
      plugin =>
        !plugin ||
        typeof plugin !== 'object' ||
        Array.isArray(plugin) ||
        (plugin as JsonObject).name !== 'panerelay',
    ),
    panerelayPlugin(hostPath),
  ];
  await writeJsonObject(path, config);
  return path;
}

export async function configureGlobalProvider(options: ConfigPathOptions = {}): Promise<string> {
  return (await setPanerelayUserDefaultProvider({ homeDirectory: options.homeDirectory })).path;
}

export async function unregisterPanerelayProvider(
  options: ConfigPathOptions = {},
): Promise<string> {
  const path = userAgentBrowserConfigPath(options.homeDirectory);
  const config = await readJsonObject(path);
  if (Array.isArray(config.plugins)) {
    const plugins = config.plugins.filter(
      plugin =>
        !plugin ||
        typeof plugin !== 'object' ||
        Array.isArray(plugin) ||
        (plugin as JsonObject).name !== 'panerelay',
    );
    if (plugins.length > 0) config.plugins = plugins;
    else delete config.plugins;
  }
  if (config.provider === 'panerelay') delete config.provider;
  if (emptyObject(config)) await rm(path, { force: true });
  else await writeJsonObject(path, config);
  return path;
}

export async function configureProjectProvider(options: ConfigPathOptions = {}): Promise<string> {
  const path = projectAgentBrowserConfigPath(options.projectDirectory);
  const config = await readJsonObject(path);
  config.provider = 'panerelay';
  await writeJsonObject(path, config);
  return path;
}

export async function removeProjectProvider(options: ConfigPathOptions = {}): Promise<string> {
  const path = projectAgentBrowserConfigPath(options.projectDirectory);
  const config = await readJsonObject(path);
  if (config.provider === 'panerelay') delete config.provider;
  if (emptyObject(config)) await rm(path, { force: true });
  else await writeJsonObject(path, config);
  return path;
}

export async function isExecutable(path: string | undefined): Promise<boolean> {
  if (!path) return false;
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
