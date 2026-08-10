import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const STATE_PROTOCOL = 'panerelay.agent-fetch-integrations.v1';
const CODEX_MCP_START = '# >>> Panerelay browser fetch MCP >>>';
const CODEX_MCP_END = '# <<< Panerelay browser fetch MCP <<<';
const CODEX_TOOLS_START = '# >>> Panerelay browser fetch tools >>>';
const CODEX_TOOLS_END = '# <<< Panerelay browser fetch tools <<<';
const CODEX_WEB_SEARCH_MARKER = '# Panerelay browser fetch managed';
const MAX_CONFIG_BYTES = 2 * 1024 * 1024;

export type AgentFetchIntegration = 'codex' | 'claude';

type CodexWebSearchState =
  { mode: 'replaced'; previousLine: string } | { mode: 'inserted' } | { mode: 'created-table' };

interface IntegrationState {
  protocol: typeof STATE_PROTOCOL;
  codex?: {
    configExisted: boolean;
    configPath: string;
    mcpBlock: string;
    webSearch: CodexWebSearchState;
  };
  claude?: {
    addedWebFetchDeny: boolean;
    configExisted: boolean;
    configPath: string;
    denyExisted: boolean;
    mcpServer: { args: string[]; command: string; type: 'stdio' };
    mcpServersExisted: boolean;
    permissionsExisted: boolean;
    settingsExisted: boolean;
    settingsPath: string;
  };
}

export interface AgentFetchIntegrationOptions {
  homeDirectory?: string;
  statePath?: string;
}

export interface AgentFetchIntegrationStatus {
  configured: boolean;
  detail: string;
  integration: AgentFetchIntegration;
}

function home(options: AgentFetchIntegrationOptions): string {
  return options.homeDirectory ?? homedir();
}

function statePath(options: AgentFetchIntegrationOptions): string {
  return options.statePath ?? join(home(options), '.panerelay', 'agent-fetch-integrations.json');
}

function codexConfigPath(options: AgentFetchIntegrationOptions): string {
  return join(home(options), '.codex', 'config.toml');
}

function claudeConfigPath(options: AgentFetchIntegrationOptions): string {
  return join(home(options), '.claude.json');
}

function claudeSettingsPath(options: AgentFetchIntegrationOptions): string {
  return join(home(options), '.claude', 'settings.json');
}

async function readBounded(path: string): Promise<string | undefined> {
  try {
    const value = await readFile(path, 'utf8');
    if (Buffer.byteLength(value) > MAX_CONFIG_BYTES) {
      throw new Error(`Agent configuration is too large to manage safely: ${path}`);
    }
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function existingMode(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).mode & 0o777;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writeProtected(
  path: string,
  value: string,
  options: { protectDirectory?: boolean } = {},
): Promise<void> {
  const directory = dirname(path);
  const temporary = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  const mode = (await existingMode(path)) ?? 0o600;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (options.protectDirectory) await chmod(directory, 0o700);
  try {
    await writeFile(temporary, value, { mode });
    await rename(temporary, path);
    await chmod(path, mode);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}

function boundedString(value: unknown, maximum = MAX_CONFIG_BYTES): value is string {
  return typeof value === 'string' && Buffer.byteLength(value) <= maximum;
}

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  const source = await readBounded(path);
  if (source === undefined) return {};
  try {
    const value = JSON.parse(source) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error(`Agent configuration is not a JSON object: ${path}`);
  }
}

async function readJsonObjectWithExistence(
  path: string,
): Promise<{ exists: boolean; value: Record<string, unknown> }> {
  const source = await readBounded(path);
  if (source === undefined) return { exists: false, value: {} };
  try {
    const value = JSON.parse(source) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return { exists: true, value: value as Record<string, unknown> };
  } catch {
    throw new Error(`Agent configuration is not a JSON object: ${path}`);
  }
}

function validState(
  value: unknown,
  options: AgentFetchIntegrationOptions,
): value is IntegrationState {
  const state = asObject(value);
  if (state.protocol !== STATE_PROTOCOL || !hasOnlyKeys(state, ['protocol', 'codex', 'claude'])) {
    return false;
  }
  if (state.codex !== undefined) {
    const codex = asObject(state.codex);
    const webSearch = asObject(codex.webSearch);
    if (
      !hasOnlyKeys(codex, ['configExisted', 'configPath', 'mcpBlock', 'webSearch']) ||
      typeof codex.configExisted !== 'boolean' ||
      codex.configPath !== codexConfigPath(options) ||
      !boundedString(codex.mcpBlock) ||
      !hasOnlyKeys(webSearch, ['mode', 'previousLine']) ||
      !['replaced', 'inserted', 'created-table'].includes(String(webSearch.mode)) ||
      (webSearch.mode === 'replaced' && !boundedString(webSearch.previousLine, 8 * 1024)) ||
      (webSearch.mode !== 'replaced' && webSearch.previousLine !== undefined)
    ) {
      return false;
    }
  }
  if (state.claude !== undefined) {
    const claude = asObject(state.claude);
    const mcpServer = asObject(claude.mcpServer);
    if (
      !hasOnlyKeys(claude, [
        'addedWebFetchDeny',
        'configExisted',
        'configPath',
        'denyExisted',
        'mcpServer',
        'mcpServersExisted',
        'permissionsExisted',
        'settingsExisted',
        'settingsPath',
      ]) ||
      typeof claude.addedWebFetchDeny !== 'boolean' ||
      typeof claude.configExisted !== 'boolean' ||
      claude.configPath !== claudeConfigPath(options) ||
      typeof claude.denyExisted !== 'boolean' ||
      typeof claude.mcpServersExisted !== 'boolean' ||
      typeof claude.permissionsExisted !== 'boolean' ||
      typeof claude.settingsExisted !== 'boolean' ||
      claude.settingsPath !== claudeSettingsPath(options) ||
      !hasOnlyKeys(mcpServer, ['type', 'command', 'args']) ||
      mcpServer.type !== 'stdio' ||
      !boundedString(mcpServer.command, 8 * 1024) ||
      !Array.isArray(mcpServer.args) ||
      mcpServer.args.length !== 1 ||
      mcpServer.args[0] !== '--fetch-mcp'
    ) {
      return false;
    }
  }
  return true;
}

async function readState(options: AgentFetchIntegrationOptions): Promise<IntegrationState> {
  const source = await readBounded(statePath(options));
  if (source === undefined) return { protocol: STATE_PROTOCOL };
  try {
    const value = JSON.parse(source) as unknown;
    if (!validState(value, options)) throw new Error();
    return value;
  } catch {
    throw new Error('Panerelay Agent fetch integration state is invalid');
  }
}

async function saveState(
  options: AgentFetchIntegrationOptions,
  state: IntegrationState,
): Promise<void> {
  if (!state.codex && !state.claude) {
    await rm(statePath(options), { force: true });
    return;
  }
  await writeProtected(statePath(options), `${JSON.stringify(state, null, 2)}\n`, {
    protectDirectory: true,
  });
}

function codexMcpBlock(launchPath: string): string {
  return [
    CODEX_MCP_START,
    '[mcp_servers.panerelay_fetch]',
    `command = ${JSON.stringify(launchPath)}`,
    `args = [${JSON.stringify('--fetch-mcp')}]`,
    CODEX_MCP_END,
  ].join('\n');
}

function blockRange(source: string, start: string, end: string): [number, number] | null {
  const first = source.indexOf(start);
  if (first < 0) return null;
  const last = source.indexOf(end, first + start.length);
  if (last < 0 || source.indexOf(start, first + start.length) >= 0) {
    throw new Error('Panerelay-managed Codex configuration markers are invalid');
  }
  return [first, last + end.length];
}

function replaceManagedBlock(source: string, previous: string | undefined, next: string): string {
  const range = blockRange(source, CODEX_MCP_START, CODEX_MCP_END);
  if (!range) {
    if (previous) throw new Error('Panerelay-managed Codex MCP configuration was removed');
    if (/^\s*\[mcp_servers\.panerelay_fetch\]\s*$/m.test(source)) {
      throw new Error('Codex already has an unmanaged panerelay_fetch MCP server');
    }
    return `${source.trimEnd()}${source.trim() ? '\n\n' : ''}${next}\n`;
  }
  const current = source.slice(range[0], range[1]);
  if (!previous || current !== previous) {
    throw new Error('Panerelay-managed Codex MCP configuration was modified');
  }
  return `${source.slice(0, range[0])}${next}${source.slice(range[1])}`;
}

function installCodexWebSearch(
  source: string,
  previous: CodexWebSearchState | undefined,
): { source: string; state: CodexWebSearchState } {
  const managedLine = `web_search = false ${CODEX_WEB_SEARCH_MARKER}`;
  if (previous) {
    if (previous.mode === 'created-table') {
      const range = blockRange(source, CODEX_TOOLS_START, CODEX_TOOLS_END);
      if (
        !range ||
        source.slice(range[0], range[1]) !==
          [CODEX_TOOLS_START, '[tools]', managedLine, CODEX_TOOLS_END].join('\n')
      ) {
        throw new Error('Panerelay-managed Codex WebSearch configuration was modified');
      }
      return { source, state: previous };
    }
    if (!source.includes(managedLine)) {
      throw new Error('Panerelay-managed Codex WebSearch configuration was modified');
    }
    return { source, state: previous };
  }

  const section = /^\s*\[tools\]\s*$/m.exec(source);
  if (!section || section.index === undefined) {
    const block = [CODEX_TOOLS_START, '[tools]', managedLine, CODEX_TOOLS_END].join('\n');
    return {
      source: `${source.trimEnd()}${source.trim() ? '\n\n' : ''}${block}\n`,
      state: { mode: 'created-table' },
    };
  }
  const sectionStart = section.index + section[0].length;
  const nextSection = /^\s*\[[^\]]+\]\s*$/gm;
  nextSection.lastIndex = sectionStart;
  const next = nextSection.exec(source);
  const sectionEnd = next?.index ?? source.length;
  const sectionBody = source.slice(sectionStart, sectionEnd);
  const existing = /^([ \t]*web_search[ \t]*=.*)$/m.exec(sectionBody);
  if (existing?.index !== undefined) {
    const absolute = sectionStart + existing.index;
    return {
      source: `${source.slice(0, absolute)}${managedLine}${source.slice(absolute + existing[1]!.length)}`,
      state: { mode: 'replaced', previousLine: existing[1]! },
    };
  }
  const insertion = `\n${CODEX_WEB_SEARCH_MARKER}\n${managedLine}`;
  return {
    source: `${source.slice(0, sectionEnd).trimEnd()}${insertion}\n${source.slice(sectionEnd).replace(/^\n/, '')}`,
    state: { mode: 'inserted' },
  };
}

function uninstallCodexWebSearch(source: string, state: CodexWebSearchState): string {
  const managedLine = `web_search = false ${CODEX_WEB_SEARCH_MARKER}`;
  if (state.mode === 'created-table') {
    const range = blockRange(source, CODEX_TOOLS_START, CODEX_TOOLS_END);
    if (!range) throw new Error('Panerelay-managed Codex WebSearch configuration is missing');
    return `${source.slice(0, range[0])}${source.slice(range[1])}`.replace(/\n{3,}/g, '\n\n');
  }
  const index = source.indexOf(managedLine);
  if (index < 0 || source.indexOf(managedLine, index + 1) >= 0) {
    throw new Error('Panerelay-managed Codex WebSearch configuration was modified');
  }
  if (state.mode === 'replaced') {
    return `${source.slice(0, index)}${state.previousLine}${source.slice(index + managedLine.length)}`;
  }
  const marker = `${CODEX_WEB_SEARCH_MARKER}\n${managedLine}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error('Panerelay-managed Codex WebSearch marker is missing');
  return `${source.slice(0, markerIndex)}${source.slice(markerIndex + marker.length)}`.replace(
    /\n{3,}/g,
    '\n\n',
  );
}

export async function installCodexFetchIntegration(
  launchPath: string,
  options: AgentFetchIntegrationOptions = {},
): Promise<string> {
  const state = await readState(options);
  const path = codexConfigPath(options);
  if (state.codex && state.codex.configPath !== path) {
    throw new Error('Panerelay Codex fetch integration belongs to another configuration path');
  }
  const existingSource = await readBounded(path);
  const configExisted = state.codex?.configExisted ?? existingSource !== undefined;
  let source = existingSource ?? '';
  const webSearch = installCodexWebSearch(source, state.codex?.webSearch);
  source = webSearch.source;
  const mcpBlock = codexMcpBlock(launchPath);
  source = replaceManagedBlock(source, state.codex?.mcpBlock, mcpBlock);
  await writeProtected(path, `${source.trimEnd()}\n`);
  state.codex = { configExisted, configPath: path, mcpBlock, webSearch: webSearch.state };
  await saveState(options, state);
  return path;
}

export async function uninstallCodexFetchIntegration(
  options: AgentFetchIntegrationOptions = {},
): Promise<string | undefined> {
  const state = await readState(options);
  if (!state.codex) return undefined;
  let source = (await readBounded(state.codex.configPath)) ?? '';
  const range = blockRange(source, CODEX_MCP_START, CODEX_MCP_END);
  if (!range || source.slice(range[0], range[1]) !== state.codex.mcpBlock) {
    throw new Error('Panerelay-managed Codex MCP configuration was modified');
  }
  source = `${source.slice(0, range[0])}${source.slice(range[1])}`.replace(/\n{3,}/g, '\n\n');
  source = uninstallCodexWebSearch(source, state.codex.webSearch);
  if (!state.codex.configExisted && !source.trim()) {
    await rm(state.codex.configPath, { force: true });
  } else {
    await writeProtected(state.codex.configPath, `${source.trimEnd()}${source.trim() ? '\n' : ''}`);
  }
  const path = state.codex.configPath;
  delete state.codex;
  await saveState(options, state);
  return path;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function installClaudeFetchIntegration(
  launchPath: string,
  options: AgentFetchIntegrationOptions = {},
): Promise<{ configPath: string; settingsPath: string }> {
  const state = await readState(options);
  const configPath = claudeConfigPath(options);
  const settingsPath = claudeSettingsPath(options);
  if (
    state.claude &&
    (state.claude.configPath !== configPath || state.claude.settingsPath !== settingsPath)
  ) {
    throw new Error('Panerelay Claude fetch integration belongs to another configuration path');
  }
  const configFile = await readJsonObjectWithExistence(configPath);
  const config = configFile.value;
  const existingServers = config.mcpServers;
  const mcpServersExisted = state.claude?.mcpServersExisted ?? existingServers !== undefined;
  const mcpServers = asObject(existingServers);
  const server = { type: 'stdio' as const, command: launchPath, args: ['--fetch-mcp'] };
  const current = mcpServers.panerelay_fetch;
  if (state.claude) {
    if (!sameJson(current, state.claude.mcpServer)) {
      throw new Error('Panerelay-managed Claude MCP configuration was modified');
    }
  } else if (current !== undefined) {
    throw new Error('Claude already has an unmanaged panerelay_fetch MCP server');
  }
  mcpServers.panerelay_fetch = server;
  config.mcpServers = mcpServers;

  const settingsFile = await readJsonObjectWithExistence(settingsPath);
  const settings = settingsFile.value;
  const permissionsExisted = state.claude?.permissionsExisted ?? settings.permissions !== undefined;
  const permissions = asObject(settings.permissions);
  const denyExisted = state.claude?.denyExisted ?? permissions.deny !== undefined;
  const deny = Array.isArray(permissions.deny)
    ? permissions.deny.filter((value): value is string => typeof value === 'string')
    : [];
  const addedWebFetchDeny = state.claude?.addedWebFetchDeny ?? !deny.includes('WebFetch');
  if (!deny.includes('WebFetch')) deny.push('WebFetch');
  permissions.deny = deny;
  settings.permissions = permissions;

  await writeProtected(configPath, `${JSON.stringify(config, null, 2)}\n`);
  await writeProtected(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  state.claude = {
    addedWebFetchDeny,
    configExisted: state.claude?.configExisted ?? configFile.exists,
    configPath,
    denyExisted,
    mcpServer: server,
    mcpServersExisted,
    permissionsExisted,
    settingsExisted: state.claude?.settingsExisted ?? settingsFile.exists,
    settingsPath,
  };
  await saveState(options, state);
  return { configPath, settingsPath };
}

export async function uninstallClaudeFetchIntegration(
  options: AgentFetchIntegrationOptions = {},
): Promise<{ configPath: string; settingsPath: string } | undefined> {
  const state = await readState(options);
  if (!state.claude) return undefined;
  const config = await readJsonObject(state.claude.configPath);
  const mcpServers = asObject(config.mcpServers);
  if (!sameJson(mcpServers.panerelay_fetch, state.claude.mcpServer)) {
    throw new Error('Panerelay-managed Claude MCP configuration was modified');
  }
  delete mcpServers.panerelay_fetch;
  if (!state.claude.mcpServersExisted && Object.keys(mcpServers).length === 0) {
    delete config.mcpServers;
  } else {
    config.mcpServers = mcpServers;
  }

  const settings = await readJsonObject(state.claude.settingsPath);
  if (state.claude.addedWebFetchDeny) {
    const permissions = asObject(settings.permissions);
    const deny = Array.isArray(permissions.deny) ? permissions.deny : [];
    if (deny.filter(value => value === 'WebFetch').length !== 1) {
      throw new Error('Panerelay-managed Claude WebFetch policy was modified');
    }
    const restoredDeny = deny.filter(value => value !== 'WebFetch');
    if (state.claude.denyExisted) {
      permissions.deny = restoredDeny;
    } else {
      delete permissions.deny;
    }
    if (!state.claude.permissionsExisted && Object.keys(permissions).length === 0) {
      delete settings.permissions;
    } else {
      settings.permissions = permissions;
    }
  }
  if (!state.claude.configExisted && Object.keys(config).length === 0) {
    await rm(state.claude.configPath, { force: true });
  } else {
    await writeProtected(state.claude.configPath, `${JSON.stringify(config, null, 2)}\n`);
  }
  if (!state.claude.settingsExisted && Object.keys(settings).length === 0) {
    await rm(state.claude.settingsPath, { force: true });
  } else {
    await writeProtected(state.claude.settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  }
  const result = { configPath: state.claude.configPath, settingsPath: state.claude.settingsPath };
  delete state.claude;
  await saveState(options, state);
  return result;
}

export async function readAgentFetchIntegrationStatus(
  integration: AgentFetchIntegration,
  options: AgentFetchIntegrationOptions = {},
): Promise<AgentFetchIntegrationStatus> {
  try {
    const state = await readState(options);
    if (integration === 'codex') {
      if (!state.codex) return { integration, configured: false, detail: 'Not configured' };
      const source = (await readBounded(state.codex.configPath)) ?? '';
      const configured =
        source.includes(state.codex.mcpBlock) &&
        source.includes(`web_search = false ${CODEX_WEB_SEARCH_MARKER}`);
      return {
        integration,
        configured,
        detail: configured ? state.codex.configPath : 'Managed Codex configuration is incomplete',
      };
    }
    if (!state.claude) return { integration, configured: false, detail: 'Not configured' };
    const config = await readJsonObject(state.claude.configPath);
    const settings = await readJsonObject(state.claude.settingsPath);
    const configured =
      sameJson(asObject(config.mcpServers).panerelay_fetch, state.claude.mcpServer) &&
      Array.isArray(asObject(settings.permissions).deny) &&
      (asObject(settings.permissions).deny as unknown[]).includes('WebFetch');
    return {
      integration,
      configured,
      detail: configured
        ? `${state.claude.configPath}; ${state.claude.settingsPath}`
        : 'Managed Claude configuration is incomplete',
    };
  } catch (error) {
    return {
      integration,
      configured: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
