import { createHash, randomBytes } from 'node:crypto';
import { chmod, link, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  PANERELAY_PROTOCOL_VERSION,
  isPanerelayChromiumBuildVersion,
  isPanerelayReleaseVersion,
  type BridgeState,
  type BrowserFamily,
} from '@panerelay/protocol';
import { bridgeStatePath } from '@panerelay/protocol/node';

export const PANERELAY_BROWSER_ID_ENV = 'PANERELAY_BROWSER_ID' as const;
export const PANERELAY_BROWSER_ENV = 'PANERELAY_BROWSER' as const;
export const PANERELAY_BROWSER_REGISTRY_PATH_ENV = 'PANERELAY_BROWSER_REGISTRY_PATH' as const;
export const PANERELAY_BROWSER_DEFAULT_PATH_ENV = 'PANERELAY_BROWSER_DEFAULT_PATH' as const;

const BROWSER_FAMILIES = new Set<BrowserFamily>(['chrome', 'chromium', 'edge', 'unknown']);

export interface BrowserDefaultState {
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  browserId: string;
  updatedAt: string;
}

export interface BrowserRegistrationStatus {
  state: BridgeState;
  ready: boolean;
}

export interface BrowserRegistryOptions {
  defaultPath?: string;
  environment?: NodeJS.ProcessEnv;
  isProcessAlive?: (pid: number) => boolean;
  legacyPath?: string;
  registryDirectory?: string;
}

export interface BrowserSelection {
  source: 'explicit' | 'default' | 'single' | 'legacy';
  state: BridgeState;
}

function environment(options: BrowserRegistryOptions): NodeJS.ProcessEnv {
  return options.environment ?? process.env;
}

export function browserRegistryDirectory(options: BrowserRegistryOptions = {}): string {
  return (
    options.registryDirectory ??
    environment(options)[PANERELAY_BROWSER_REGISTRY_PATH_ENV] ??
    join(homedir(), '.panerelay', 'browsers')
  );
}

export function browserDefaultPath(options: BrowserRegistryOptions = {}): string {
  return (
    options.defaultPath ??
    environment(options)[PANERELAY_BROWSER_DEFAULT_PATH_ENV] ??
    join(homedir(), '.panerelay', 'browser-default.json')
  );
}

export function browserRegistrationPath(
  browserId: string,
  options: BrowserRegistryOptions = {},
): string {
  const digest = createHash('sha256').update(browserId).digest('hex');
  return join(browserRegistryDirectory(options), `${digest}.json`);
}

function liveProcess(pid: number, options: BrowserRegistryOptions): boolean {
  if (options.isProcessAlive) return options.isProcessAlive(pid);
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isBrowserFamily(value: unknown): value is BrowserFamily {
  return typeof value === 'string' && BROWSER_FAMILIES.has(value as BrowserFamily);
}

function isBridgeState(value: unknown): value is BridgeState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<BridgeState>;
  return (
    state.protocol === PANERELAY_PROTOCOL_VERSION &&
    typeof state.pid === 'number' &&
    Number.isSafeInteger(state.pid) &&
    state.pid > 0 &&
    typeof state.port === 'number' &&
    Number.isSafeInteger(state.port) &&
    state.port > 0 &&
    state.port <= 65_535 &&
    typeof state.token === 'string' &&
    state.token.length > 0 &&
    typeof state.generation === 'string' &&
    /^[A-Za-z0-9._:-]{1,128}$/.test(state.generation) &&
    typeof state.browserId === 'string' &&
    state.browserId.length > 0 &&
    typeof state.browserName === 'string' &&
    state.browserName.length > 0 &&
    isPanerelayReleaseVersion(state.extensionReleaseVersion) &&
    isPanerelayChromiumBuildVersion(state.extensionBuildVersion) &&
    isPanerelayReleaseVersion(state.hostVersion) &&
    typeof state.extensionId === 'string' &&
    state.extensionId.length > 0 &&
    (state.browserFamily === undefined || isBrowserFamily(state.browserFamily)) &&
    (state.capabilities === undefined ||
      (state.capabilities !== null &&
        typeof state.capabilities === 'object' &&
        typeof state.capabilities.cdpRelay === 'boolean')) &&
    typeof state.updatedAt === 'string' &&
    Number.isFinite(Date.parse(state.updatedAt))
  );
}

function isBrowserDefaultState(value: unknown): value is BrowserDefaultState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<BrowserDefaultState>;
  return (
    state.protocol === PANERELAY_PROTOCOL_VERSION &&
    typeof state.browserId === 'string' &&
    state.browserId.length > 0 &&
    typeof state.updatedAt === 'string' &&
    Number.isFinite(Date.parse(state.updatedAt))
  );
}

async function writeProtectedJson(path: string, value: unknown): Promise<void> {
  const directory = dirname(path);
  const temporaryPath = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

export async function writeBrowserRegistration(
  state: BridgeState,
  options: BrowserRegistryOptions = {},
): Promise<void> {
  if (!isBridgeState(state)) throw new Error('Panerelay browser registration is invalid');
  await writeProtectedJson(browserRegistrationPath(state.browserId, options), state);
}

async function readRegistrationPath(
  path: string,
  expectedBrowserId: string | undefined,
  options: BrowserRegistryOptions,
): Promise<BridgeState | null> {
  try {
    const state = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (!isBridgeState(state)) return null;
    if (expectedBrowserId !== undefined && state.browserId !== expectedBrowserId) return null;
    if (!liveProcess(state.pid, options)) return null;
    return state;
  } catch {
    return null;
  }
}

export async function readLiveBrowserRegistration(
  browserId: string,
  options: BrowserRegistryOptions = {},
): Promise<BridgeState | null> {
  return readRegistrationPath(browserRegistrationPath(browserId, options), browserId, options);
}

export async function listBrowserRegistrations(
  options: BrowserRegistryOptions = {},
): Promise<BrowserRegistrationStatus[]> {
  let entries: string[];
  try {
    entries = await readdir(browserRegistryDirectory(options));
  } catch {
    return [];
  }
  const states = await Promise.all(
    entries
      .filter(entry => /^[a-f0-9]{64}\.json$/.test(entry))
      .map(async entry => ({
        entry,
        state: await readRegistrationPath(
          join(browserRegistryDirectory(options), entry),
          undefined,
          options,
        ),
      })),
  );
  return states
    .filter(
      (
        value,
      ): value is {
        entry: string;
        state: BridgeState;
      } =>
        value.state !== null &&
        value.entry === `${createHash('sha256').update(value.state.browserId).digest('hex')}.json`,
    )
    .map(value => value.state)
    .sort((left, right) => left.browserId.localeCompare(right.browserId))
    .map(state => ({ state, ready: state.capabilities?.cdpRelay !== false }));
}

export async function removeOwnedBrowserRegistration(
  browserId: string,
  ownerPid = process.pid,
  options: BrowserRegistryOptions = {},
): Promise<void> {
  const path = browserRegistrationPath(browserId, options);
  try {
    const state = JSON.parse(await readFile(path, 'utf8')) as Partial<BridgeState>;
    if (state.browserId === browserId && state.pid === ownerPid) {
      await rm(path, { force: true });
    }
  } catch {
    // A missing or unreadable state file is already effectively removed.
  }
}

export async function readBrowserDefault(
  options: BrowserRegistryOptions = {},
): Promise<BrowserDefaultState | null> {
  try {
    const state = JSON.parse(await readFile(browserDefaultPath(options), 'utf8')) as unknown;
    return isBrowserDefaultState(state) ? state : null;
  } catch {
    return null;
  }
}

export async function setBrowserDefault(
  browserId: string,
  options: BrowserRegistryOptions = {},
): Promise<BrowserDefaultState> {
  if (!browserId) throw new Error('A browser registration ID is required');
  const state: BrowserDefaultState = {
    protocol: PANERELAY_PROTOCOL_VERSION,
    browserId,
    updatedAt: new Date().toISOString(),
  };
  await writeProtectedJson(browserDefaultPath(options), state);
  return state;
}

export async function clearBrowserDefault(
  expectedBrowserId?: string,
  options: BrowserRegistryOptions = {},
): Promise<BrowserDefaultState | null> {
  const path = browserDefaultPath(options);
  const current = await readBrowserDefault(options);
  if (!current) return null;
  if (expectedBrowserId !== undefined && current.browserId !== expectedBrowserId) return current;

  const removedPath = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.removed`;
  try {
    await rename(path, removedPath);
  } catch {
    return readBrowserDefault(options);
  }

  const removed = await (async (): Promise<BrowserDefaultState | null> => {
    try {
      const value = JSON.parse(await readFile(removedPath, 'utf8')) as unknown;
      return isBrowserDefaultState(value) ? value : null;
    } catch {
      return null;
    }
  })();
  if (expectedBrowserId !== undefined && removed?.browserId !== expectedBrowserId) {
    try {
      await link(removedPath, path);
    } catch {
      // A newer default already occupies the path and wins the race.
    }
  }
  await rm(removedPath, { force: true });
  return readBrowserDefault(options);
}

function describeRegistrations(registrations: BrowserRegistrationStatus[]): string {
  return registrations
    .map(
      ({ state }) =>
        `${state.browserName} (${state.browserFamily ?? 'unknown'}: ${state.browserId})`,
    )
    .join(', ');
}

function assertReady(state: BridgeState): BridgeState {
  if (state.capabilities?.cdpRelay === false) {
    throw new Error(
      `${state.browserName} does not support Panerelay browser automation because its Extension cannot provide a CDP relay`,
    );
  }
  return state;
}

export async function readLiveLegacyBrowserRegistration(
  options: BrowserRegistryOptions = {},
): Promise<BridgeState | null> {
  const path = options.legacyPath ?? environment(options).PANERELAY_STATE_PATH ?? bridgeStatePath();
  return readRegistrationPath(path, undefined, options);
}

export async function selectBrowserRegistration(
  options: BrowserRegistryOptions = {},
): Promise<BrowserSelection> {
  const currentRegistrations = await listBrowserRegistrations(options);
  const legacy =
    currentRegistrations.length === 0 ? await readLiveLegacyBrowserRegistration(options) : null;
  const registrations = legacy
    ? [{ state: legacy, ready: legacy.capabilities?.cdpRelay !== false }]
    : currentRegistrations;
  const ready = registrations.filter(registration => registration.ready);
  const selectedSource = (
    currentSource: Exclude<BrowserSelection['source'], 'legacy'>,
  ): BrowserSelection['source'] => (legacy ? 'legacy' : currentSource);
  const env = environment(options);
  const exactSelector = env[PANERELAY_BROWSER_ID_ENV]?.trim();
  const browserSelector = env[PANERELAY_BROWSER_ENV]?.trim();
  const selector = exactSelector || browserSelector;

  if (selector) {
    const exact = registrations.find(registration => registration.state.browserId === selector);
    if (exact) return { source: selectedSource('explicit'), state: assertReady(exact.state) };
    if (exactSelector) {
      throw new Error(
        `Panerelay browser ${exactSelector} is unavailable. Reopen that browser or choose another registration.`,
      );
    }
    const normalized = selector.toLowerCase();
    if (BROWSER_FAMILIES.has(normalized as BrowserFamily)) {
      const matches = ready.filter(
        registration => (registration.state.browserFamily ?? 'unknown') === normalized,
      );
      if (matches.length === 1) {
        return { source: selectedSource('explicit'), state: matches[0]!.state };
      }
      if (matches.length > 1) {
        throw new Error(
          `Panerelay browser selector "${selector}" is ambiguous. Use PANERELAY_BROWSER_ID with one of: ${describeRegistrations(matches)}`,
        );
      }
    }
    throw new Error(
      `Panerelay browser selector "${selector}" is unavailable. Live browsers: ${describeRegistrations(registrations) || 'none'}`,
    );
  }

  const savedDefault = await readBrowserDefault(options);
  if (savedDefault) {
    const selected = registrations.find(
      registration => registration.state.browserId === savedDefault.browserId,
    );
    if (!selected || !selected.ready) {
      throw new Error(
        `The default Panerelay browser (${savedDefault.browserId}) is unavailable. Reopen it, choose another default, or clear the default.`,
      );
    }
    return { source: selectedSource('default'), state: selected.state };
  }

  if (ready.length === 1) {
    return { source: selectedSource('single'), state: ready[0]!.state };
  }
  if (ready.length > 1) {
    throw new Error(
      `Multiple Panerelay browsers are ready. Set a default or use PANERELAY_BROWSER_ID with one of: ${describeRegistrations(ready)}`,
    );
  }
  if (registrations.length > 0) {
    throw new Error(
      `No registered Panerelay browser can provide a CDP relay. Registered browsers: ${describeRegistrations(registrations)}`,
    );
  }

  throw new Error(
    'Panerelay Bridge is unavailable. Build and load the extension, then authorize a tab.',
  );
}
