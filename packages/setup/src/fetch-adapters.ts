import { createHash, randomBytes } from 'node:crypto';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import {
  PANERELAY_FETCH_ADAPTER_MAX_ARTIFACT_BYTES,
  PANERELAY_FETCH_ADAPTER_REGISTRY_PROTOCOL,
  isFetchAdapterManifest,
  type FetchAdapterManifest,
  type FetchAdapterRegistration,
  type FetchAdapterRegistry,
} from '@panerelay/protocol';
import {
  fetchAdapterDataDirectory,
  fetchAdapterRegistryPath,
  readFetchAdapterRegistry,
  type FetchAdapterRegistryOptions,
} from '@panerelay/cli';
import { builtinSiteSources } from '@panerelay/sites';

export interface FetchAdapterInstallOptions extends FetchAdapterRegistryOptions {
  builtinSources?: Record<string, string>;
}

export type FetchAdapterRemoveOptions = FetchAdapterRegistryOptions;

interface ValidatedSource {
  entryPath: string;
  manifest: FetchAdapterManifest;
}

function packagedBuiltinSources(): Record<string, string> {
  return builtinSiteSources();
}

export function builtinFetchAdapterIds(): string[] {
  return Object.keys(packagedBuiltinSources()).sort();
}

function isPosix(): boolean {
  return process.platform !== 'win32';
}

async function protectedDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (isPosix()) await chmod(path, 0o700);
}

async function protectedFile(path: string): Promise<void> {
  if (isPosix()) await chmod(path, 0o600);
}

async function regularSourceFile(path: string, label: string): Promise<void> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error(`${label} is not a regular file`);
  if (metadata.size > PANERELAY_FETCH_ADAPTER_MAX_ARTIFACT_BYTES) {
    throw new Error(`${label} exceeds the adapter artifact limit`);
  }
}

async function resolveSource(value: string, builtins: Record<string, string>): Promise<string[]> {
  if (value === 'all') return Object.values(builtins);
  if (builtins[value]) return [builtins[value]];
  const pathLike = value.includes('/') || value.includes('\\') || isAbsolute(value);
  if (pathLike) return [resolve(value)];
  try {
    if ((await stat(resolve(value))).isDirectory()) return [resolve(value)];
  } catch {
    // Fall through to the bounded catalog error.
  }
  throw new Error(`Unknown fetch adapter source: ${value}`);
}

async function validateSource(sourceDirectory: string): Promise<ValidatedSource> {
  const directoryMetadata = await lstat(sourceDirectory);
  if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
    throw new Error(`Fetch adapter source is not a regular directory: ${sourceDirectory}`);
  }
  const manifestPath = join(sourceDirectory, 'panerelay-fetch-adapter.json');
  await regularSourceFile(manifestPath, 'Fetch adapter manifest');
  let manifest: unknown;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  } catch {
    throw new Error(`Fetch adapter manifest is not valid JSON: ${manifestPath}`);
  }
  if (!isFetchAdapterManifest(manifest)) {
    throw new Error(`Fetch adapter manifest is invalid: ${manifestPath}`);
  }
  const entryPath = resolve(sourceDirectory, manifest.entry);
  if (dirname(entryPath) !== resolve(sourceDirectory)) {
    throw new Error(
      `Fetch adapter ${manifest.id} entry must be directly inside its source directory`,
    );
  }
  const sourceEntries = (await readdir(sourceDirectory)).sort();
  const expectedEntries = ['panerelay-fetch-adapter.json', manifest.entry].sort();
  if (
    sourceEntries.length !== expectedEntries.length ||
    !sourceEntries.every((entry, index) => entry === expectedEntries[index])
  ) {
    throw new Error(
      `Fetch adapter ${manifest.id} source must contain exactly its manifest and entry`,
    );
  }
  await regularSourceFile(entryPath, `Fetch adapter ${manifest.id} entry`);
  return { entryPath, manifest };
}

async function writeProtectedRegistry(
  registry: FetchAdapterRegistry,
  options: FetchAdapterRegistryOptions,
): Promise<void> {
  const path = fetchAdapterRegistryPath(options);
  const temporary = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
  await protectedFile(temporary);
  await rename(temporary, path);
}

function expectedVersionDirectory(
  registration: FetchAdapterRegistration,
  options: FetchAdapterRegistryOptions,
): string {
  return join(
    fetchAdapterDataDirectory(options),
    registration.manifest.id,
    registration.manifest.version,
  );
}

async function removeOtherVersions(
  registration: FetchAdapterRegistration,
  options: FetchAdapterRegistryOptions,
): Promise<void> {
  const idDirectory = join(fetchAdapterDataDirectory(options), registration.manifest.id);
  let entries: string[];
  try {
    entries = await readdir(idDirectory);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === registration.manifest.version) continue;
    const target = join(idDirectory, entry);
    if (dirname(target) !== idDirectory) continue;
    await rm(target, { recursive: true, force: true });
  }
}

export async function installFetchAdapters(
  sources: string[],
  options: FetchAdapterInstallOptions = {},
): Promise<FetchAdapterRegistration[]> {
  if (sources.length === 0) throw new Error('At least one fetch adapter source is required');
  const builtins = options.builtinSources ?? packagedBuiltinSources();
  const resolved = (
    await Promise.all(sources.map(source => resolveSource(source, builtins)))
  ).flat();
  const uniqueSources = [...new Set(resolved)];
  const validated = await Promise.all(uniqueSources.map(validateSource));
  const ids = validated.map(source => source.manifest.id);
  if (new Set(ids).size !== ids.length)
    throw new Error('A fetch adapter batch contains duplicate IDs');

  const registryDirectory = fetchAdapterDataDirectory(options);
  await protectedDirectory(registryDirectory);
  const current = await readFetchAdapterRegistry(options);
  const stagingRoot = join(
    registryDirectory,
    `.install-${process.pid}-${randomBytes(6).toString('hex')}`,
  );
  await protectedDirectory(stagingRoot);
  const staged = new Map<string, { directory: string; registration: FetchAdapterRegistration }>();
  try {
    for (const source of validated) {
      const directory = join(stagingRoot, source.manifest.id, source.manifest.version);
      await protectedDirectory(directory);
      const entry = join(directory, source.manifest.entry);
      await copyFile(source.entryPath, entry);
      await protectedFile(entry);
      await writeFile(
        join(directory, 'panerelay-fetch-adapter.json'),
        `${JSON.stringify(source.manifest, null, 2)}\n`,
        { mode: 0o600 },
      );
      const sha256 = createHash('sha256')
        .update(await readFile(entry))
        .digest('hex');
      staged.set(source.manifest.id, {
        directory,
        registration: {
          manifest: source.manifest,
          executablePath: join(
            registryDirectory,
            source.manifest.id,
            source.manifest.version,
            source.manifest.entry,
          ),
          sha256,
        },
      });
    }

    const backups = new Map<string, string>();
    const installedTargets: string[] = [];
    try {
      for (const source of validated) {
        const target = join(registryDirectory, source.manifest.id, source.manifest.version);
        await protectedDirectory(dirname(target));
        try {
          await lstat(target);
          const backup = `${target}.backup-${randomBytes(6).toString('hex')}`;
          await rename(target, backup);
          backups.set(target, backup);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        await rename(staged.get(source.manifest.id)!.directory, target);
        installedTargets.push(target);
      }

      const replacements = new Map(
        [...staged.values()].map(value => [value.registration.manifest.id, value.registration]),
      );
      const registry: FetchAdapterRegistry = {
        protocol: PANERELAY_FETCH_ADAPTER_REGISTRY_PROTOCOL,
        adapters: [
          ...current.adapters.filter(adapter => !replacements.has(adapter.manifest.id)),
          ...replacements.values(),
        ].sort((left, right) => left.manifest.id.localeCompare(right.manifest.id)),
      };
      await writeProtectedRegistry(registry, options);
      await Promise.all(
        [...backups.values()].map(path => rm(path, { recursive: true, force: true })),
      );
      await Promise.all(
        [...replacements.values()].map(value => removeOtherVersions(value, options)),
      );
      return [...replacements.values()];
    } catch (error) {
      for (const target of installedTargets.reverse())
        await rm(target, { recursive: true, force: true });
      for (const [target, backup] of [...backups.entries()].reverse()) {
        await rename(backup, target).catch(() => undefined);
      }
      throw error;
    }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

export async function listFetchAdapters(
  options: FetchAdapterRegistryOptions = {},
): Promise<FetchAdapterRegistration[]> {
  return (await readFetchAdapterRegistry(options)).adapters;
}

export async function removeFetchAdapters(
  ids: string[] | 'all',
  options: FetchAdapterRemoveOptions = {},
): Promise<string[]> {
  const current = await readFetchAdapterRegistry(options);
  const selected =
    ids === 'all' ? current.adapters.map(adapter => adapter.manifest.id) : [...new Set(ids)];
  if (selected.length === 0) {
    if (ids === 'all') return [];
    throw new Error('At least one fetch adapter ID is required');
  }
  const selectedSet = new Set(selected);
  const removed = current.adapters.filter(adapter => selectedSet.has(adapter.manifest.id));
  const missing = selected.filter(id => !removed.some(adapter => adapter.manifest.id === id));
  if (missing.length > 0) throw new Error(`Fetch adapter is not installed: ${missing.join(', ')}`);
  const registry: FetchAdapterRegistry = {
    protocol: PANERELAY_FETCH_ADAPTER_REGISTRY_PROTOCOL,
    adapters: current.adapters.filter(adapter => !selectedSet.has(adapter.manifest.id)),
  };
  await writeProtectedRegistry(registry, options);
  for (const registration of removed) {
    const target = expectedVersionDirectory(registration, options);
    const expectedPrefix = `${join(fetchAdapterDataDirectory(options), registration.manifest.id)}${sep}`;
    if (!`${target}${sep}`.startsWith(expectedPrefix)) {
      throw new Error(
        `Refusing to remove fetch adapter outside protected storage: ${registration.manifest.id}`,
      );
    }
    await rm(target, { recursive: true, force: true });
    await rm(dirname(target), { recursive: false }).catch(() => undefined);
  }
  return removed.map(adapter => adapter.manifest.id);
}
