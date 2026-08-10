import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import {
  PANERELAY_FETCH_ADAPTER_MAX_FILE_BYTES,
  PANERELAY_FETCH_ADAPTER_MAX_SOURCE_PATH_BYTES,
  type FetchAdapterCommand,
  type FetchAdapterInvocationArtifact,
} from '@panerelay/protocol';

export interface PreparedFetchAdapterArtifacts {
  args: Record<string, string | number | boolean>;
  artifacts?: FetchAdapterInvocationArtifact[];
}

function mediaTypeFor(name: string): string {
  const types: Record<string, string> = {
    '.csv': 'text/csv',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.json': 'application/json',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.txt': 'text/plain',
    '.webp': 'image/webp',
    '.zip': 'application/zip',
  };
  return types[extname(name).toLowerCase()] ?? 'application/octet-stream';
}

function sameIdentity(
  left: Awaited<ReturnType<typeof lstat>>,
  right: Awaited<ReturnType<typeof lstat>>,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

async function prepareArtifact(
  argumentName: string,
  path: string,
): Promise<FetchAdapterInvocationArtifact> {
  if (
    !path ||
    Buffer.byteLength(path, 'utf8') > PANERELAY_FETCH_ADAPTER_MAX_SOURCE_PATH_BYTES ||
    /\0/.test(path)
  ) {
    throw new Error(`File argument ${argumentName} has an invalid path`);
  }
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const pathBefore = await lstat(path);
    if (!pathBefore.isFile() || pathBefore.isSymbolicLink()) {
      throw new Error(`File argument ${argumentName} must be a non-symlink regular file`);
    }
    if (pathBefore.size > PANERELAY_FETCH_ADAPTER_MAX_FILE_BYTES) {
      throw new Error(`File argument ${argumentName} exceeds the 12 MiB limit`);
    }
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const openedBefore = await handle.stat();
    if (!openedBefore.isFile() || !sameIdentity(pathBefore, openedBefore)) {
      throw new Error(`File argument ${argumentName} changed before it could be read`);
    }
    const data = await handle.readFile();
    if (data.length > PANERELAY_FETCH_ADAPTER_MAX_FILE_BYTES) {
      throw new Error(`File argument ${argumentName} exceeds the 12 MiB limit`);
    }
    const [openedAfter, pathAfter] = await Promise.all([handle.stat(), lstat(path)]);
    if (
      !sameIdentity(openedBefore, openedAfter) ||
      openedAfter.dev !== pathAfter.dev ||
      openedAfter.ino !== pathAfter.ino ||
      openedAfter.size !== data.length
    ) {
      throw new Error(`File argument ${argumentName} changed while it was read`);
    }
    const safeBasename = basename(path);
    if (
      !safeBasename ||
      safeBasename === '.' ||
      safeBasename === '..' ||
      /[\r\n\p{Cc}]/u.test(safeBasename)
    ) {
      throw new Error(`File argument ${argumentName} has an unsafe filename`);
    }
    return {
      id: `artifact_${randomUUID().replaceAll('-', '')}`,
      basename: safeBasename,
      mediaType: mediaTypeFor(safeBasename),
      size: data.length,
      data: data.toString('base64'),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`File argument ${argumentName}`)) {
      throw error;
    }
    throw new Error(`Unable to read file argument ${argumentName}`, { cause: error });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export async function prepareFetchAdapterArtifacts(
  command: FetchAdapterCommand,
  args: Record<string, string | number | boolean>,
): Promise<PreparedFetchAdapterArtifacts> {
  const fileArgument = command.args.find(argument => argument.type === 'file');
  if (!fileArgument) return { args };
  const path = args[fileArgument.name];
  if (path === undefined) return { args };
  if (typeof path !== 'string') throw new Error(`File argument ${fileArgument.name} is invalid`);
  const artifact = await prepareArtifact(fileArgument.name, path);
  return {
    args: { ...args, [fileArgument.name]: artifact.id },
    artifacts: [artifact],
  };
}
