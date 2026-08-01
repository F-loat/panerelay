import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import {
  PANERELAY_BROWSER_ENV,
  PANERELAY_BROWSER_ID_ENV,
  selectBrowserRegistration,
  type BrowserSelection,
} from '@panerelay/browser-registry';
import {
  CLI_ADAPTER_MAX_MESSAGE_BYTES,
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  parseCliAdapterResponse,
  serializeCliAdapterMessage,
  type CliAdapterActor,
  type CliAdapterManifest,
  type CliAdapterMode,
  type CliAdapterRequest,
  type CliAdapterResolvedConnection,
  type CliAdapterResponse,
} from '@panerelay/protocol';
import {
  readCliAdapterMode,
  setCliAdapterMode,
  type CliAdapterPreferenceOptions,
} from './adapter-preferences.js';
import {
  cliAdapterDataDirectory,
  readCliAdapterRegistration,
  type CliAdapterRegistration,
  type CliAdapterRegistryOptions,
} from './adapter-registry.js';

const ADAPTER_TIMEOUT_MS = 5_000;

export class CliAdapterDispatchError extends Error {
  constructor(
    readonly code:
      | 'adapter-missing'
      | 'adapter-incompatible'
      | 'adapter-unavailable'
      | 'adapter-timeout'
      | 'adapter-invalid-response'
      | 'browser-unavailable'
      | 'generation-changed'
      | 'not-ready'
      | 'busy',
    message: string,
  ) {
    super(message);
    this.name = 'CliAdapterDispatchError';
  }
}

export interface CliAdapterInvocationOptions {
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  timeoutMs?: number;
  trustedDirectory?: string;
}

interface ExecutableIdentity {
  dev: number;
  ino: number;
  mode: number;
  mtimeMs: number;
  size: number;
}

function sameExecutableIdentity(left: ExecutableIdentity, right: ExecutableIdentity): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.mtimeMs === right.mtimeMs &&
    left.size === right.size
  );
}

async function assertProtectedExecutable(
  executablePath: string,
  trustedDirectory: string | undefined,
  platform: NodeJS.Platform = process.platform,
): Promise<ExecutableIdentity> {
  try {
    const metadata = await lstat(executablePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('not a regular file');
    if (
      platform !== 'win32' &&
      ((metadata.mode & 0o100) === 0 ||
        (metadata.mode & 0o022) !== 0 ||
        (typeof process.getuid === 'function' && metadata.uid !== process.getuid()))
    ) {
      throw new Error('unsafe executable permissions');
    }

    if (trustedDirectory) {
      const root = resolve(trustedDirectory);
      let current = resolve(dirname(executablePath));
      const relativeDirectory = relative(root, current);
      if (relativeDirectory.startsWith('..') || isAbsolute(relativeDirectory)) {
        throw new Error('executable is outside trusted storage');
      }
      while (true) {
        const directoryMetadata = await lstat(current);
        if (
          !directoryMetadata.isDirectory() ||
          directoryMetadata.isSymbolicLink() ||
          (platform !== 'win32' &&
            ((directoryMetadata.mode & 0o022) !== 0 ||
              (typeof process.getuid === 'function' && directoryMetadata.uid !== process.getuid())))
        ) {
          throw new Error('unsafe executable directory');
        }
        if (current === root) break;
        const parent = dirname(current);
        if (parent === current) {
          throw new Error('executable is outside trusted storage');
        }
        current = parent;
      }
    }
    return {
      dev: metadata.dev,
      ino: metadata.ino,
      mode: metadata.mode,
      mtimeMs: metadata.mtimeMs,
      size: metadata.size,
    };
  } catch {
    throw new CliAdapterDispatchError(
      'adapter-unavailable',
      'Registered connection adapter executable is missing or unsafe',
    );
  }
}

const WINDOWS_COMMAND_META_CHARACTERS = /([()%!^"`<>&|;, *?])/g;

function escapeWindowsCommand(value: string): string {
  return value.replace(WINDOWS_COMMAND_META_CHARACTERS, '^$1');
}

export function resolveCliAdapterSpawn(
  executablePath: string,
  platform: NodeJS.Platform = process.platform,
  commandInterpreter: string | undefined = process.env.ComSpec,
): { args: string[]; command: string; windowsVerbatimArguments?: boolean } {
  if (platform !== 'win32' || !/\.(?:cmd|bat)$/i.test(executablePath)) {
    return { command: executablePath, args: [] };
  }
  return {
    command: commandInterpreter || 'cmd.exe',
    args: ['/d', '/s', '/c', `"${escapeWindowsCommand(executablePath)}"`],
    windowsVerbatimArguments: true,
  };
}

async function invokeCliAdapter(
  registration: CliAdapterRegistration,
  request: CliAdapterRequest,
  options: CliAdapterInvocationOptions = {},
): Promise<CliAdapterResponse> {
  await assertProtectedExecutable(
    registration.executablePath,
    options.trustedDirectory,
    options.platform,
  );
  const serialized = serializeCliAdapterMessage(request);
  return new Promise((resolve, reject) => {
    const launch = resolveCliAdapterSpawn(
      registration.executablePath,
      options.platform,
      options.environment?.ComSpec,
    );
    const child = spawn(launch.command, launch.args, {
      env: options.environment ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsVerbatimArguments: launch.windowsVerbatimArguments,
      windowsHide: true,
    });
    let output = '';
    let outputBytes = 0;
    let settled = false;
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    const fail = (error: CliAdapterDispatchError): void => {
      child.kill('SIGKILL');
      finish(() => reject(error));
    };
    const timer = setTimeout(() => {
      fail(new CliAdapterDispatchError('adapter-timeout', 'Connection adapter timed out'));
    }, options.timeoutMs ?? ADAPTER_TIMEOUT_MS);
    timer.unref();

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > CLI_ADAPTER_MAX_MESSAGE_BYTES) {
        fail(
          new CliAdapterDispatchError(
            'adapter-invalid-response',
            'Connection adapter response exceeded the protocol limit',
          ),
        );
        return;
      }
      output += chunk;
    });
    child.stderr.resume();
    child.on('error', () => {
      finish(() =>
        reject(
          new CliAdapterDispatchError(
            'adapter-unavailable',
            'Registered connection adapter could not be started',
          ),
        ),
      );
    });
    child.on('close', code => {
      if (settled) return;
      if (code !== 0) {
        finish(() =>
          reject(
            new CliAdapterDispatchError(
              'adapter-unavailable',
              'Registered connection adapter exited before returning a result',
            ),
          ),
        );
        return;
      }
      try {
        const response = parseCliAdapterResponse(output.trim());
        if (response.requestId !== request.requestId || response.operation !== request.operation) {
          throw new Error('response correlation mismatch');
        }
        finish(() => resolve(response));
      } catch {
        finish(() =>
          reject(
            new CliAdapterDispatchError(
              'adapter-invalid-response',
              'Connection adapter returned an invalid response',
            ),
          ),
        );
      }
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(serialized);
  });
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

function manifestMatchesRegistration(
  manifest: CliAdapterManifest,
  registration: CliAdapterRegistration,
): boolean {
  return (
    manifest.adapterId === registration.adapterId &&
    manifest.version === registration.version &&
    manifest.protocol === registration.protocol &&
    sameSet(manifest.capabilities, registration.capabilities) &&
    sameSet(manifest.modes, registration.modes) &&
    sameSet(manifest.childEnvironmentKeys, registration.childEnvironmentKeys)
  );
}

async function verifiedManifest(
  registration: CliAdapterRegistration,
  options: CliAdapterInvocationOptions,
): Promise<{ identity: ExecutableIdentity; manifest: CliAdapterManifest }> {
  const identity = await assertProtectedExecutable(
    registration.executablePath,
    options.trustedDirectory,
    options.platform,
  );
  const request: CliAdapterRequest = {
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    requestId: randomUUID(),
    operation: 'adapter.manifest',
    input: {},
  };
  const response = await invokeCliAdapter(registration, request, options);
  const afterIdentity = await assertProtectedExecutable(
    registration.executablePath,
    options.trustedDirectory,
    options.platform,
  );
  if (!sameExecutableIdentity(identity, afterIdentity)) {
    throw new CliAdapterDispatchError(
      'adapter-incompatible',
      'Connection adapter executable changed during manifest verification',
    );
  }
  if (!response.success || response.operation !== 'adapter.manifest') {
    throw new CliAdapterDispatchError(
      'adapter-incompatible',
      'Connection adapter manifest request failed',
    );
  }
  const manifest = response.result as CliAdapterManifest;
  if (!manifestMatchesRegistration(manifest, registration)) {
    throw new CliAdapterDispatchError(
      'adapter-incompatible',
      'Connection adapter manifest does not match its protected registration',
    );
  }
  return { identity: afterIdentity, manifest };
}

function mapAdapterFailure(response: Extract<CliAdapterResponse, { success: false }>): never {
  const code = response.error.code;
  const dispatchCode =
    code === 'browser-unavailable' ||
    code === 'generation-changed' ||
    code === 'not-ready' ||
    code === 'busy'
      ? code
      : code === 'timeout'
        ? 'adapter-timeout'
        : code === 'incompatible-protocol'
          ? 'adapter-incompatible'
          : 'adapter-unavailable';
  const messages = {
    'adapter-missing': 'Connection adapter is not installed',
    'adapter-incompatible': 'Connection adapter is incompatible',
    'adapter-unavailable': 'Connection adapter is unavailable',
    'adapter-timeout': 'Connection adapter timed out',
    'adapter-invalid-response': 'Connection adapter returned an invalid response',
    'browser-unavailable': 'The selected browser became unavailable',
    'generation-changed': 'The selected browser connection changed; run the command again',
    'not-ready': 'The selected connection is not ready',
    busy: 'The selected connection lane is busy',
  } as const;
  throw new CliAdapterDispatchError(dispatchCode, messages[dispatchCode]);
}

export interface ResolveCliConnectionInput {
  adapterId: string;
  actor: CliAdapterActor;
  browserSelector?: string;
  mode?: CliAdapterMode;
}

export interface ResolvedCliConnection extends CliAdapterResolvedConnection {
  adapterId: string;
}

export interface CliConnectionResolverDependencies {
  invokeAdapter?: typeof invokeCliAdapter;
  readAdapterMode?: typeof readCliAdapterMode;
  readAdapterRegistration?: typeof readCliAdapterRegistration;
  setAdapterMode?: typeof setCliAdapterMode;
  selectBrowserRegistration?: typeof selectBrowserRegistration;
}

export interface CliConnectionResolverOptions {
  adapterInvocation?: CliAdapterInvocationOptions;
  adapterPreferences?: CliAdapterPreferenceOptions;
  adapterRegistry?: CliAdapterRegistryOptions;
  dependencies?: CliConnectionResolverDependencies;
  environment?: NodeJS.ProcessEnv;
}

function registrationGeneration(selection: BrowserSelection): string {
  return selection.state.generation;
}

export async function resolveCliConnection(
  input: ResolveCliConnectionInput,
  options: CliConnectionResolverOptions = {},
): Promise<ResolvedCliConnection> {
  const dependencies = options.dependencies ?? {};
  const registration = await (dependencies.readAdapterRegistration ?? readCliAdapterRegistration)(
    input.adapterId,
    options.adapterRegistry,
  );
  if (!registration) {
    throw new CliAdapterDispatchError(
      'adapter-missing',
      `Connection adapter "${input.adapterId}" is not installed`,
    );
  }
  const mode =
    input.mode ??
    (await (dependencies.readAdapterMode ?? readCliAdapterMode)(
      input.adapterId,
      options.adapterPreferences,
    )) ??
    'direct';
  if (!registration.modes.includes(mode)) {
    throw new CliAdapterDispatchError(
      'adapter-incompatible',
      `Connection adapter "${input.adapterId}" does not support ${mode} mode`,
    );
  }
  if (mode === 'direct') {
    return {
      adapterId: input.adapterId,
      mode,
      connection: { kind: 'direct' },
      environment: {},
    };
  }

  const baseEnvironment = options.environment ?? process.env;
  const selectedEnvironment = input.browserSelector
    ? {
        ...baseEnvironment,
        [PANERELAY_BROWSER_ID_ENV]: undefined,
        [PANERELAY_BROWSER_ENV]: input.browserSelector,
      }
    : baseEnvironment;
  let selection: BrowserSelection;
  try {
    selection = await (dependencies.selectBrowserRegistration ?? selectBrowserRegistration)({
      environment: selectedEnvironment,
    });
  } catch (error) {
    throw new CliAdapterDispatchError(
      'browser-unavailable',
      error instanceof Error ? error.message : 'No Panerelay browser is available',
    );
  }

  const invocation = dependencies.invokeAdapter ?? invokeCliAdapter;
  const invocationOptions = {
    ...options.adapterInvocation,
    environment: baseEnvironment,
    trustedDirectory:
      options.adapterInvocation?.trustedDirectory ??
      cliAdapterDataDirectory(options.adapterRegistry),
  };
  let executableIdentity: ExecutableIdentity | undefined;
  if (!dependencies.invokeAdapter) {
    executableIdentity = (await verifiedManifest(registration, invocationOptions)).identity;
  }
  const request: CliAdapterRequest = {
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    requestId: randomUUID(),
    operation: 'connection.resolve',
    input: {
      mode,
      actor: input.actor,
      browser: {
        browserId: selection.state.browserId,
        generation: registrationGeneration(selection),
      },
    },
  };
  if (executableIdentity) {
    const currentIdentity = await assertProtectedExecutable(
      registration.executablePath,
      invocationOptions.trustedDirectory,
      invocationOptions.platform,
    );
    if (!sameExecutableIdentity(executableIdentity, currentIdentity)) {
      throw new CliAdapterDispatchError(
        'adapter-incompatible',
        'Connection adapter executable changed after manifest verification',
      );
    }
  }
  const response = await invocation(registration, request, invocationOptions);
  if (!response.success) mapAdapterFailure(response);
  if (response.operation !== 'connection.resolve') {
    throw new CliAdapterDispatchError(
      'adapter-invalid-response',
      'Connection adapter returned the wrong operation result',
    );
  }
  const result = response.result as CliAdapterResolvedConnection;
  const allowedEnvironment = new Set(registration.childEnvironmentKeys);
  if (
    result.mode !== mode ||
    Object.keys(result.environment).some(key => !allowedEnvironment.has(key)) ||
    (result.expiresAt !== undefined && Date.parse(result.expiresAt) <= Date.now())
  ) {
    throw new CliAdapterDispatchError(
      'adapter-invalid-response',
      'Connection adapter returned connection material outside its registration',
    );
  }
  return { adapterId: input.adapterId, ...result };
}

export async function saveCliConnectionMode(
  adapterId: string,
  mode: CliAdapterMode,
  options: CliConnectionResolverOptions = {},
): Promise<void> {
  const registration = await (
    options.dependencies?.readAdapterRegistration ?? readCliAdapterRegistration
  )(adapterId, options.adapterRegistry);
  if (!registration) {
    throw new CliAdapterDispatchError(
      'adapter-missing',
      `Connection adapter "${adapterId}" is not installed`,
    );
  }
  if (!registration.modes.includes(mode)) {
    throw new CliAdapterDispatchError(
      'adapter-incompatible',
      `Connection adapter "${adapterId}" does not support ${mode} mode`,
    );
  }
  const writer = options.dependencies?.setAdapterMode ?? setCliAdapterMode;
  await writer(adapterId, mode, options.adapterPreferences);
}
