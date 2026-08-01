import { createHash, randomBytes } from 'node:crypto';
import { chmod, lstat, mkdir, open, readFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CliAdapterDispatchError } from './adapter-dispatcher.js';

export const PANERELAY_CLI_ADAPTER_LOCK_DIRECTORY_ENV =
  'PANERELAY_CLI_ADAPTER_LOCK_DIRECTORY' as const;
const LOCK_PROTOCOL = 'panerelay.cli-adapter-lock.v1' as const;
const DEFAULT_WAIT_MS = 750;
const POLL_MS = 50;

interface LockRecord {
  protocol: typeof LOCK_PROTOCOL;
  pid: number;
  token: string;
  createdAt: string;
}

export interface CliConcurrencyLockOptions {
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  isProcessAlive?: (pid: number) => boolean;
  lockDirectory?: string;
  waitMs?: number;
}

export interface CliConcurrencyLock {
  release(): Promise<void>;
}

function lockDirectory(options: CliConcurrencyLockOptions): string {
  return (
    options.lockDirectory ??
    options.environment?.[PANERELAY_CLI_ADAPTER_LOCK_DIRECTORY_ENV] ??
    join(options.homeDirectory ?? homedir(), '.panerelay', 'locks', 'cli-adapters')
  );
}

function lockPath(key: string, options: CliConcurrencyLockOptions): string {
  const digest = createHash('sha256').update(key).digest('hex');
  return join(lockDirectory(options), `${digest}.lock`);
}

function isLockRecord(value: unknown): value is LockRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 4 &&
    candidate.protocol === LOCK_PROTOCOL &&
    typeof candidate.pid === 'number' &&
    Number.isSafeInteger(candidate.pid) &&
    candidate.pid > 0 &&
    typeof candidate.token === 'string' &&
    /^[a-f0-9]{32}$/.test(candidate.token) &&
    typeof candidate.createdAt === 'string' &&
    Number.isFinite(Date.parse(candidate.createdAt))
  );
}

function processAlive(pid: number, options: CliConcurrencyLockOptions): boolean {
  if (options.isProcessAlive) return options.isProcessAlive(pid);
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readProtectedLock(
  filePath: string,
  options: CliConcurrencyLockOptions,
): Promise<LockRecord> {
  const metadata = await lstat(filePath);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    (process.platform !== 'win32' && (metadata.mode & 0o077) !== 0)
  ) {
    throw new CliAdapterDispatchError('busy', 'Connection lane lock is unsafe');
  }
  const value = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  if (!isLockRecord(value)) {
    throw new CliAdapterDispatchError('busy', 'Connection lane lock is invalid');
  }
  if (!processAlive(value.pid, options)) {
    await unlink(filePath).catch(() => undefined);
    throw new Error('STALE_LOCK_REMOVED');
  }
  return value;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function acquireCliConcurrencyLock(
  key: string,
  options: CliConcurrencyLockOptions = {},
): Promise<CliConcurrencyLock> {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
    throw new CliAdapterDispatchError('busy', 'Connection lane lock key is invalid');
  }
  const directory = lockDirectory(options);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await chmod(directory, 0o700);
  const filePath = lockPath(key, options);
  const token = randomBytes(16).toString('hex');
  const record: LockRecord = {
    protocol: LOCK_PROTOCOL,
    pid: process.pid,
    token,
    createdAt: new Date().toISOString(),
  };
  const waitMs = Math.max(0, Math.min(options.waitMs ?? DEFAULT_WAIT_MS, 5_000));
  const deadline = Date.now() + waitMs;

  while (true) {
    try {
      const handle = await open(filePath, 'wx', 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(record)}\n`);
      } finally {
        await handle.close();
      }
      return {
        release: async () => {
          try {
            const current = await readProtectedLock(filePath, {
              ...options,
              isProcessAlive: pid => pid === process.pid || processAlive(pid, options),
            });
            if (current.token === token) await unlink(filePath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              // A missing, replaced, or damaged lock is never removed by this owner.
            }
          }
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        if (error instanceof CliAdapterDispatchError) throw error;
        throw new CliAdapterDispatchError('busy', 'Connection lane lock is unavailable');
      }
      try {
        await readProtectedLock(filePath, options);
      } catch (readError) {
        if (readError instanceof Error && readError.message === 'STALE_LOCK_REMOVED') continue;
        if ((readError as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw readError;
      }
      if (Date.now() >= deadline) {
        throw new CliAdapterDispatchError('busy', 'Another command is using this connection lane');
      }
      await delay(Math.min(POLL_MS, Math.max(1, deadline - Date.now())));
    }
  }
}
