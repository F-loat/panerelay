import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BridgeState } from '@panerelay/protocol';
import { bridgeStatePath } from '@panerelay/protocol/node';

export async function writeBridgeState(state: BridgeState): Promise<void> {
  const path = bridgeStatePath();
  const directory = dirname(path);
  const temporaryPath = `${path}.${process.pid}.tmp`;

  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

export async function removeOwnedBridgeState(): Promise<void> {
  const path = bridgeStatePath();
  try {
    const state = JSON.parse(await readFile(path, 'utf8')) as Partial<BridgeState>;
    if (state.pid === process.pid) await rm(path, { force: true });
  } catch {
    // A missing or unreadable state file is already effectively removed.
  }
}
