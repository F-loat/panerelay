import { randomBytes } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  isCliAdapterManifest,
  type CliAdapterCapability,
  type CliAdapterMode,
} from '@panerelay/protocol';

export const PANERELAY_CLI_ADAPTER_REGISTRY_VERSION = 'panerelay.cli-adapter-registry.v1' as const;
export const PANERELAY_CLI_ADAPTER_REGISTRY_PATH_ENV =
  'PANERELAY_CLI_ADAPTER_REGISTRY_PATH' as const;

export interface CliAdapterRegistration {
  adapterId: string;
  version: string;
  executablePath: string;
  protocol: typeof PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION;
  capabilities: CliAdapterCapability[];
  modes: CliAdapterMode[];
  childEnvironmentKeys: string[];
}

export interface CliAdapterRegistry {
  protocol: typeof PANERELAY_CLI_ADAPTER_REGISTRY_VERSION;
  adapters: CliAdapterRegistration[];
}

export interface CliAdapterRegistryOptions {
  dataDirectory?: string;
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
  registryPath?: string;
}

export function cliAdapterDataDirectory(options: CliAdapterRegistryOptions = {}): string {
  const paths = pathImplementation(options.platform ?? process.platform);
  return options.dataDirectory ?? paths.join(options.homeDirectory ?? homedir(), '.panerelay');
}

export function cliAdapterRegistryPath(options: CliAdapterRegistryOptions = {}): string {
  return (
    options.registryPath ??
    options.environment?.[PANERELAY_CLI_ADAPTER_REGISTRY_PATH_ENV] ??
    pathImplementation(options.platform ?? process.platform).join(
      cliAdapterDataDirectory(options),
      'cli-adapters.json',
    )
  );
}

function pathImplementation(platform: NodeJS.Platform): typeof path.posix | typeof path.win32 {
  return platform === 'win32' ? path.win32 : path.posix;
}

function isContainedPath(candidate: string, parent: string, platform: NodeJS.Platform): boolean {
  const implementation = pathImplementation(platform);
  if (!implementation.isAbsolute(candidate) || !implementation.isAbsolute(parent)) return false;
  const resolvedCandidate = implementation.resolve(candidate);
  const resolvedParent = implementation.resolve(parent);
  const relative = implementation.relative(resolvedParent, resolvedCandidate);
  if (platform === 'win32') {
    return relative !== '' && !relative.startsWith('..') && !implementation.isAbsolute(relative);
  }
  return relative !== '' && !relative.startsWith('..') && !implementation.isAbsolute(relative);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function isCliAdapterRegistration(
  value: unknown,
  options: CliAdapterRegistryOptions = {},
): value is CliAdapterRegistration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !hasExactKeys(candidate, [
      'adapterId',
      'version',
      'executablePath',
      'protocol',
      'capabilities',
      'modes',
      'childEnvironmentKeys',
    ]) ||
    typeof candidate.executablePath !== 'string' ||
    !isContainedPath(
      candidate.executablePath,
      cliAdapterDataDirectory(options),
      options.platform ?? process.platform,
    )
  ) {
    return false;
  }
  return isCliAdapterManifest({
    adapterId: candidate.adapterId,
    name: 'Registered connection adapter',
    version: candidate.version,
    protocol: candidate.protocol,
    capabilities: candidate.capabilities,
    modes: candidate.modes,
    childEnvironmentKeys: candidate.childEnvironmentKeys,
  });
}

function isCliAdapterRegistry(
  value: unknown,
  options: CliAdapterRegistryOptions,
): value is CliAdapterRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !hasExactKeys(candidate, ['protocol', 'adapters']) ||
    candidate.protocol !== PANERELAY_CLI_ADAPTER_REGISTRY_VERSION ||
    !Array.isArray(candidate.adapters) ||
    candidate.adapters.length > 32 ||
    !candidate.adapters.every(adapter => isCliAdapterRegistration(adapter, options))
  ) {
    return false;
  }
  const adapterIds = candidate.adapters.map(adapter => adapter.adapterId);
  return new Set(adapterIds).size === adapterIds.length;
}

async function assertProtectedFile(
  filePath: string,
  trustedDirectory: string,
  platform: NodeJS.Platform,
): Promise<void> {
  const paths = pathImplementation(platform);
  const root = paths.resolve(trustedDirectory);
  let current = paths.resolve(paths.dirname(filePath));
  const relativeDirectory = paths.relative(root, current);
  if (relativeDirectory.startsWith('..') || paths.isAbsolute(relativeDirectory)) {
    throw new Error('Panerelay CLI adapter registry is outside protected storage');
  }
  while (true) {
    const directoryMetadata = await lstat(current);
    if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
      throw new Error('Panerelay CLI adapter registry directory is not protected');
    }
    if (platform !== 'win32' && (directoryMetadata.mode & 0o077) !== 0) {
      throw new Error('Panerelay CLI adapter registry directory permissions are too broad');
    }
    if (current === root) break;
    const parent = paths.dirname(current);
    if (parent === current) {
      throw new Error('Panerelay CLI adapter registry is outside protected storage');
    }
    current = parent;
  }
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error('Panerelay CLI adapter registry is not a protected regular file');
  }
  if (platform !== 'win32' && (metadata.mode & 0o077) !== 0) {
    throw new Error('Panerelay CLI adapter registry permissions are too broad');
  }
}

export async function readCliAdapterRegistry(
  options: CliAdapterRegistryOptions = {},
): Promise<CliAdapterRegistry> {
  const registryPath = cliAdapterRegistryPath(options);
  try {
    await assertProtectedFile(
      registryPath,
      cliAdapterDataDirectory(options),
      options.platform ?? process.platform,
    );
    const value = JSON.parse(await readFile(registryPath, 'utf8')) as unknown;
    if (!isCliAdapterRegistry(value, options)) {
      throw new Error('Panerelay CLI adapter registry is invalid');
    }
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { protocol: PANERELAY_CLI_ADAPTER_REGISTRY_VERSION, adapters: [] };
    }
    throw error;
  }
}

async function writeCliAdapterRegistry(
  registry: CliAdapterRegistry,
  options: CliAdapterRegistryOptions,
): Promise<void> {
  if (!isCliAdapterRegistry(registry, options)) {
    throw new Error('Panerelay CLI adapter registry is invalid');
  }
  const registryPath = cliAdapterRegistryPath(options);
  const platform = options.platform ?? process.platform;
  const directory = pathImplementation(platform).dirname(registryPath);
  const temporaryPath = `${registryPath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (platform !== 'win32') await chmod(directory, 0o700);
  await writeFile(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, registryPath);
  if (platform !== 'win32') await chmod(registryPath, 0o600);
}

export async function registerCliAdapter(
  registration: CliAdapterRegistration,
  options: CliAdapterRegistryOptions = {},
): Promise<CliAdapterRegistry> {
  if (!isCliAdapterRegistration(registration, options)) {
    throw new Error('Panerelay CLI adapter registration is invalid');
  }
  const registry = await readCliAdapterRegistry(options);
  const adapters = registry.adapters.filter(
    adapter => adapter.adapterId !== registration.adapterId,
  );
  adapters.push(registration);
  adapters.sort((left, right) => left.adapterId.localeCompare(right.adapterId));
  const next: CliAdapterRegistry = { ...registry, adapters };
  await writeCliAdapterRegistry(next, options);
  return next;
}

export async function removeCliAdapterRegistration(
  adapterId: string,
  options: CliAdapterRegistryOptions = {},
): Promise<CliAdapterRegistry> {
  const registry = await readCliAdapterRegistry(options);
  const next: CliAdapterRegistry = {
    ...registry,
    adapters: registry.adapters.filter(adapter => adapter.adapterId !== adapterId),
  };
  if (next.adapters.length !== registry.adapters.length) {
    await writeCliAdapterRegistry(next, options);
  }
  return next;
}

export async function readCliAdapterRegistration(
  adapterId: string,
  options: CliAdapterRegistryOptions = {},
): Promise<CliAdapterRegistration | null> {
  const registry = await readCliAdapterRegistry(options);
  return registry.adapters.find(adapter => adapter.adapterId === adapterId) ?? null;
}
