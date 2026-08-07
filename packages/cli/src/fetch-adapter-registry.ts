import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import {
  PANERELAY_FETCH_ADAPTER_REGISTRY_PROTOCOL,
  isFetchAdapterRegistry,
  type FetchAdapterRegistration,
  type FetchAdapterRegistry,
} from '@panerelay/protocol';

export const PANERELAY_FETCH_ADAPTER_REGISTRY_PATH_ENV =
  'PANERELAY_FETCH_ADAPTER_REGISTRY_PATH' as const;

export interface FetchAdapterRegistryOptions {
  environment?: NodeJS.ProcessEnv;
  registryPath?: string;
  verifyExecutables?: boolean;
}

export function fetchAdapterRegistryPath(options: FetchAdapterRegistryOptions = {}): string {
  return (
    options.registryPath ??
    (options.environment ?? process.env)[PANERELAY_FETCH_ADAPTER_REGISTRY_PATH_ENV] ??
    join(homedir(), '.panerelay', 'fetch-adapters', 'registry.json')
  );
}

export function fetchAdapterDataDirectory(options: FetchAdapterRegistryOptions = {}): string {
  return dirname(fetchAdapterRegistryPath(options));
}

function isPosix(): boolean {
  return process.platform !== 'win32';
}

async function assertProtectedRegularFile(path: string, label: string): Promise<void> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${label} is not a regular file`);
  }
  if (isPosix()) {
    if ((metadata.mode & 0o077) !== 0) throw new Error(`${label} permissions must be 0600`);
    if (typeof process.getuid === 'function' && metadata.uid !== process.getuid()) {
      throw new Error(`${label} is owned by another user`);
    }
  }
}

async function assertProtectedDirectory(path: string, label: string): Promise<void> {
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`${label} is not a regular directory`);
  }
  if (isPosix()) {
    if ((metadata.mode & 0o077) !== 0) throw new Error(`${label} permissions must be 0700`);
    if (typeof process.getuid === 'function' && metadata.uid !== process.getuid()) {
      throw new Error(`${label} is owned by another user`);
    }
  }
}

async function verifyRegistration(
  registration: FetchAdapterRegistration,
  options: FetchAdapterRegistryOptions,
): Promise<void> {
  const registryDirectory = fetchAdapterDataDirectory(options);
  const expected = resolve(
    registryDirectory,
    registration.manifest.id,
    registration.manifest.version,
    registration.manifest.entry,
  );
  if (resolve(registration.executablePath) !== expected) {
    throw new Error(
      `Fetch adapter ${registration.manifest.id} executable is outside its version directory`,
    );
  }
  await assertProtectedRegularFile(expected, `Fetch adapter ${registration.manifest.id}`);
  const root = resolve(registryDirectory);
  let currentDirectory = dirname(expected);
  while (true) {
    await assertProtectedDirectory(
      currentDirectory,
      `Fetch adapter ${registration.manifest.id} directory`,
    );
    if (currentDirectory === root) break;
    const parent = dirname(currentDirectory);
    if (parent === currentDirectory || !`${currentDirectory}${sep}`.startsWith(`${root}${sep}`)) {
      throw new Error(
        `Fetch adapter ${registration.manifest.id} directory is outside protected storage`,
      );
    }
    currentDirectory = parent;
  }
  const [realDirectory, realExecutable] = await Promise.all([
    realpath(registryDirectory),
    realpath(expected),
  ]);
  const expectedRealPrefix = `${join(realDirectory, registration.manifest.id, registration.manifest.version)}${sep}`;
  if (!realExecutable.startsWith(expectedRealPrefix)) {
    throw new Error(`Fetch adapter ${registration.manifest.id} resolves outside protected storage`);
  }
  const digest = createHash('sha256')
    .update(await readFile(realExecutable))
    .digest('hex');
  if (digest !== registration.sha256) {
    throw new Error(`Fetch adapter ${registration.manifest.id} executable digest changed`);
  }
}

export async function readFetchAdapterRegistry(
  options: FetchAdapterRegistryOptions = {},
): Promise<FetchAdapterRegistry> {
  const path = fetchAdapterRegistryPath(options);
  try {
    await assertProtectedDirectory(dirname(path), 'Fetch adapter registry directory');
    await assertProtectedRegularFile(path, 'Fetch adapter registry');
    const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (!isFetchAdapterRegistry(value)) throw new Error('Fetch adapter registry is invalid');
    if (options.verifyExecutables) {
      for (const registration of value.adapters) await verifyRegistration(registration, options);
    }
    return value;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { protocol: PANERELAY_FETCH_ADAPTER_REGISTRY_PROTOCOL, adapters: [] };
    }
    throw error;
  }
}

export async function readFetchAdapterRegistration(
  id: string,
  options: FetchAdapterRegistryOptions = {},
): Promise<FetchAdapterRegistration | null> {
  const registry = await readFetchAdapterRegistry({ ...options, verifyExecutables: true });
  return registry.adapters.find(adapter => adapter.manifest.id === id) ?? null;
}
