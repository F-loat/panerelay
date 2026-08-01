import { constants } from 'node:os';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  resolveCliConnection,
  type CliConnectionResolverOptions,
  type ResolveCliConnectionInput,
} from './adapter-dispatcher.js';
import { acquireCliConcurrencyLock, type CliConcurrencyLockOptions } from './concurrency-lock.js';

const FORWARDED_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'] as const;

export interface RunCliConnectionInput extends ResolveCliConnectionInput {
  childCommand: string[];
}

export interface CliCommandRunnerDependencies {
  acquireLock?: typeof acquireCliConcurrencyLock;
  resolveConnection?: typeof resolveCliConnection;
  spawnChild?: typeof spawn;
}

export interface CliCommandRunnerOptions extends CliConnectionResolverOptions {
  concurrencyLock?: CliConcurrencyLockOptions;
  runnerDependencies?: CliCommandRunnerDependencies;
}

function signalExitCode(signal: NodeJS.Signals): number {
  return 128 + (constants.signals[signal] ?? 0);
}

async function waitForChild(child: ChildProcess): Promise<number> {
  const listeners = new Map<NodeJS.Signals, () => void>();
  for (const signal of FORWARDED_SIGNALS) {
    const listener = (): void => {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    };
    try {
      process.on(signal, listener);
      listeners.set(signal, listener);
    } catch {
      // The platform may not expose every POSIX signal.
    }
  }
  try {
    return await new Promise<number>((resolve, reject) => {
      let settled = false;
      child.once('error', () => {
        if (settled) return;
        settled = true;
        reject(new Error('Child command could not be started'));
      });
      child.once('exit', (code, signal) => {
        if (settled) return;
        settled = true;
        resolve(code ?? (signal ? signalExitCode(signal) : 1));
      });
    });
  } finally {
    for (const [signal, listener] of listeners) process.off(signal, listener);
  }
}

export async function runCliConnectionCommand(
  input: RunCliConnectionInput,
  options: CliCommandRunnerOptions = {},
): Promise<number> {
  if (input.childCommand.length === 0 || !input.childCommand[0]) {
    throw new Error('A child command is required');
  }
  const resolved = await (options.runnerDependencies?.resolveConnection ?? resolveCliConnection)(
    input,
    options,
  );
  const environment = {
    ...(options.environment ?? process.env),
    ...resolved.environment,
  };
  const lock = resolved.concurrencyKey
    ? await (options.runnerDependencies?.acquireLock ?? acquireCliConcurrencyLock)(
        resolved.concurrencyKey,
        options.concurrencyLock,
      )
    : null;
  try {
    const child = (options.runnerDependencies?.spawnChild ?? spawn)(
      input.childCommand[0],
      input.childCommand.slice(1),
      {
        env: environment,
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    return await waitForChild(child);
  } finally {
    await lock?.release();
  }
}
