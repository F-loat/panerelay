import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CliAdapterDispatchError } from './adapter-dispatcher.js';
import { acquireCliConcurrencyLock } from './concurrency-lock.js';

test('serializes one user-scoped lane and releases only its own lock', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-cli-lock-'));
  const options = { lockDirectory: directory, waitMs: 20 };
  try {
    const first = await acquireCliConcurrencyLock('browser-use-lane', options);
    await assert.rejects(
      acquireCliConcurrencyLock('browser-use-lane', options),
      (error: unknown) => error instanceof CliAdapterDispatchError && error.code === 'busy',
    );
    const independent = await acquireCliConcurrencyLock('another-lane', options);
    await independent.release();
    await first.release();
    const next = await acquireCliConcurrencyLock('browser-use-lane', options);
    await next.release();
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('recovers a protected lock whose owner process is gone', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'panerelay-cli-stale-lock-'));
  const key = 'browser-use-lane';
  const filePath = join(directory, `${createHash('sha256').update(key).digest('hex')}.lock`);
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') await chmod(directory, 0o700);
    await writeFile(
      filePath,
      `${JSON.stringify({
        protocol: 'panerelay.cli-adapter-lock.v1',
        pid: 999_999,
        token: '0123456789abcdef0123456789abcdef',
        createdAt: '2026-08-01T01:02:03.000Z',
      })}\n`,
      { mode: 0o600 },
    );
    const lock = await acquireCliConcurrencyLock(key, {
      lockDirectory: directory,
      isProcessAlive: () => false,
      waitMs: 0,
    });
    await lock.release();
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
