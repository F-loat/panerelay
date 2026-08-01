import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { delimiter, dirname, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import {
  readLiveBrowserRegistration,
  type BrowserRegistryOptions,
} from '@panerelay/browser-registry';
import {
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  PANERELAY_PROTOCOL_VERSION,
  isCdpBootstrapCreated,
  type BridgeState,
  type CdpBootstrapCreated,
  type CdpBootstrapError,
  type CliAdapterDoctorResult,
  type CliAdapterFailureResponse,
  type CliAdapterManifest,
  type CliAdapterRequest,
  type CliAdapterResponse,
  type CliAdapterSuccessResponse,
} from '@panerelay/protocol';

export const BROWSER_USE_ADAPTER_ID = 'browser-use' as const;
export const SUPPORTED_BROWSER_USE_VERSION = '0.13.7' as const;
export const SUPPORTED_BROWSER_HARNESS_VERSION = '0.1.8' as const;
export const BROWSER_USE_CHILD_ENVIRONMENT_KEYS = [
  'ANONYMIZED_TELEMETRY',
  'BH_RECORD',
  'BH_RUNTIME_DIR',
  'BH_RUNTIME_DIR_SHARED',
  'BH_TELEMETRY',
  'BH_TMP_DIR',
  'BH_TMP_DIR_SHARED',
  'BU_CDP_URL',
  'BU_NAME',
] as const;

const executeFile = promisify(execFile);

export interface BrowserUseVersions {
  browserUseExecutable?: string;
  browserUse?: string;
  browserHarness?: string;
}

export interface BrowserUseAdapterDependencies {
  adapterVersion?: string;
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  probeVersions?: () => Promise<BrowserUseVersions>;
  fetch?: typeof fetch;
  homeDirectory?: string;
  readLiveBrowserRegistration?: typeof readLiveBrowserRegistration;
  registryOptions?: BrowserRegistryOptions;
  runtimeDirectory?: string;
}

function success(
  request: CliAdapterRequest,
  result: CliAdapterSuccessResponse['result'],
): CliAdapterSuccessResponse {
  return {
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    requestId: request.requestId,
    operation: request.operation,
    success: true,
    result,
  };
}

function failure(
  request: CliAdapterRequest,
  code: CliAdapterFailureResponse['error']['code'],
  message: string,
  retryable = false,
): CliAdapterFailureResponse {
  return {
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    requestId: request.requestId,
    operation: request.operation,
    success: false,
    error: { code, message: message.slice(0, 512), retryable },
  };
}

export function browserUseAdapterManifest(version: string): CliAdapterManifest {
  return {
    adapterId: BROWSER_USE_ADAPTER_ID,
    name: 'Panerelay Browser Use connection adapter',
    version,
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    capabilities: ['connection.resolve', 'adapter.doctor'],
    modes: ['direct', 'extension'],
    childEnvironmentKeys: [...BROWSER_USE_CHILD_ENVIRONMENT_KEYS],
  };
}

async function resolveExecutable(
  executable: string,
  environment: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): Promise<string | null> {
  if (isAbsolute(executable)) {
    try {
      await access(executable);
      return executable;
    } catch {
      return null;
    }
  }
  const extensions =
    platform === 'win32' ? (environment.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  for (const directory of (environment.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = join(directory, `${executable}${extension}`);
      try {
        await access(candidate);
        return candidate;
      } catch {
        // Continue through the bounded PATH candidates.
      }
    }
  }
  return null;
}

async function pythonForBrowserUse(
  executablePath: string,
  environment: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): Promise<string | null> {
  const configured = environment.PANERELAY_BROWSER_USE_PYTHON;
  if (configured && isAbsolute(configured)) return configured;
  if (platform === 'win32') {
    const candidate = join(dirname(executablePath), 'python.exe');
    try {
      await access(candidate);
      return candidate;
    } catch {
      return null;
    }
  }
  try {
    const header = (await readFile(executablePath, 'utf8')).slice(0, 512);
    const shebang = /^#!([^\r\n]+)/.exec(header)?.[1]?.trim();
    return shebang && isAbsolute(shebang) ? shebang : null;
  } catch {
    return null;
  }
}

export async function probeBrowserUseVersions(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<BrowserUseVersions> {
  const executable = await resolveExecutable(
    environment.PANERELAY_BROWSER_USE_EXECUTABLE ?? 'browser-use',
    environment,
    platform,
  );
  if (!executable) return {};
  const python = await pythonForBrowserUse(executable, environment, platform);
  if (!python) return { browserUseExecutable: executable };
  try {
    const result = await executeFile(
      python,
      [
        '-c',
        "import importlib.metadata as m,json; print(json.dumps({'browserUse':m.version('browser-use'),'browserHarness':m.version('browser-harness')}))",
      ],
      {
        encoding: 'utf8',
        env: environment,
        maxBuffer: 2_048,
        timeout: 3_000,
        windowsHide: true,
      },
    );
    const value = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
    return {
      browserUseExecutable: executable,
      ...(typeof value.browserUse === 'string'
        ? { browserUse: value.browserUse.slice(0, 64) }
        : {}),
      ...(typeof value.browserHarness === 'string'
        ? { browserHarness: value.browserHarness.slice(0, 64) }
        : {}),
    };
  } catch {
    return { browserUseExecutable: executable };
  }
}

async function doctor(
  dependencies: BrowserUseAdapterDependencies,
): Promise<CliAdapterDoctorResult> {
  const environment = dependencies.environment ?? process.env;
  const versions = await (
    dependencies.probeVersions ??
    (() => probeBrowserUseVersions(environment, dependencies.platform ?? process.platform))
  )();
  const browserUseReady = versions.browserUse === SUPPORTED_BROWSER_USE_VERSION;
  const browserHarnessReady = versions.browserHarness === SUPPORTED_BROWSER_HARNESS_VERSION;
  return {
    status: browserUseReady && browserHarnessReady ? 'ready' : 'unavailable',
    checks: [
      {
        id: 'node-runtime',
        status: Number(process.versions.node.split('.')[0]) >= 20 ? 'pass' : 'fail',
        version: process.versions.node,
      },
      {
        id: 'browser-use',
        status: browserUseReady ? 'pass' : 'fail',
        ...(versions.browserUse ? { version: versions.browserUse } : {}),
        ...(!browserUseReady
          ? {
              message: versions.browserUse
                ? `Browser Use ${SUPPORTED_BROWSER_USE_VERSION} is required`
                : 'Browser Use was not found',
            }
          : {}),
      },
      {
        id: 'browser-harness',
        status: browserHarnessReady ? 'pass' : 'fail',
        ...(versions.browserHarness ? { version: versions.browserHarness } : {}),
        ...(!browserHarnessReady
          ? {
              message: versions.browserHarness
                ? `Browser Harness ${SUPPORTED_BROWSER_HARNESS_VERSION} is required`
                : 'Browser Harness was not found in the Browser Use environment',
            }
          : {}),
      },
    ],
  };
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const maximum = 64 * 1024;
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximum) {
    await response.body?.cancel();
    throw new Error('Bridge response exceeded the adapter limit');
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Error('Bridge response exceeded the adapter limit');
    }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

function expectedBootstrapUrl(state: BridgeState, value: CdpBootstrapCreated): boolean {
  try {
    const url = new URL(value.cdpUrl);
    return (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      Number(url.port) === state.port &&
      /^\/cdp\/bootstrap\/[A-Za-z0-9_-]{43}$/.test(url.pathname) &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

async function requestBootstrap(
  request: Extract<CliAdapterRequest, { operation: 'connection.resolve' }>,
  dependencies: BrowserUseAdapterDependencies,
): Promise<CdpBootstrapCreated | CliAdapterFailureResponse> {
  const selected = request.input.browser;
  if (!selected) return failure(request, 'invalid-request', 'A selected browser is required');
  const environment = dependencies.environment ?? process.env;
  const state = await (dependencies.readLiveBrowserRegistration ?? readLiveBrowserRegistration)(
    selected.browserId,
    dependencies.registryOptions ?? { environment },
  );
  if (!state) {
    return failure(
      request,
      'browser-unavailable',
      'The selected Panerelay browser is unavailable',
      true,
    );
  }
  if (state.browserId !== selected.browserId || state.generation !== selected.generation) {
    return failure(
      request,
      'generation-changed',
      'The selected browser connection changed; run the command again',
      true,
    );
  }
  if (state.capabilities?.cdpRelay === false) {
    return failure(request, 'not-ready', 'The selected browser cannot provide a CDP relay');
  }
  try {
    const response = await (dependencies.fetch ?? fetch)(
      `http://127.0.0.1:${state.port}/cdp/bootstrap`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${state.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          protocol: PANERELAY_PROTOCOL_VERSION,
          browser: {
            browserId: state.browserId,
            generation: state.generation,
          },
          actor: {
            kind: 'automation',
            name: request.input.actor.name,
            ...(request.input.actor.sessionLabel
              ? { sessionLabel: request.input.actor.sessionLabel }
              : {}),
          },
          laneKey: 'browser-use:panerelay',
          connectionPolicy: 'single',
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    const body = await readBoundedJson(response);
    if (
      response.status === 201 &&
      isCdpBootstrapCreated(body) &&
      expectedBootstrapUrl(state, body)
    ) {
      return body;
    }
    const errorCode =
      body && typeof body === 'object'
        ? (body as Partial<CdpBootstrapError>).error?.code
        : undefined;
    if (errorCode === 'generation-changed') {
      return failure(
        request,
        'generation-changed',
        'The selected browser connection changed; run the command again',
        true,
      );
    }
    if (response.status === 429 || errorCode === 'ticket-limit' || errorCode === 'lane-busy') {
      return failure(request, 'busy', 'The Panerelay Browser Use lane is busy', true);
    }
    if (response.status === 503 || errorCode === 'browser-unavailable') {
      return failure(request, 'browser-unavailable', 'The selected browser is unavailable', true);
    }
    return failure(request, 'not-ready', 'Panerelay could not create a CDP bootstrap ticket', true);
  } catch {
    return failure(
      request,
      'browser-unavailable',
      'The selected browser connection is unavailable',
      true,
    );
  }
}

export async function handleBrowserUseAdapterRequest(
  request: CliAdapterRequest,
  dependencies: BrowserUseAdapterDependencies = {},
): Promise<CliAdapterResponse> {
  const version = dependencies.adapterVersion ?? '0.2.0';
  if (request.operation === 'adapter.manifest') {
    return success(request, browserUseAdapterManifest(version));
  }
  if (request.operation === 'adapter.doctor') {
    return success(request, await doctor(dependencies));
  }
  if (request.input.mode === 'direct') {
    return success(request, {
      mode: 'direct',
      connection: { kind: 'direct' },
      environment: {},
    });
  }
  const bootstrap = await requestBootstrap(request, dependencies);
  if ('success' in bootstrap) return bootstrap;
  const runtimeDirectory =
    dependencies.runtimeDirectory ??
    join(dependencies.homeDirectory ?? homedir(), '.panerelay', 'browser-use', 'runtime');
  const temporaryDirectory = join(dirname(runtimeDirectory), 'tmp');
  return success(request, {
    mode: 'extension',
    connection: { kind: 'cdp-http', url: bootstrap.cdpUrl },
    environment: {
      ANONYMIZED_TELEMETRY: 'false',
      BH_RECORD: '0',
      BH_RUNTIME_DIR: runtimeDirectory,
      BH_RUNTIME_DIR_SHARED: '0',
      BH_TELEMETRY: '0',
      BH_TMP_DIR: temporaryDirectory,
      BH_TMP_DIR_SHARED: '0',
      BU_CDP_URL: bootstrap.cdpUrl,
      BU_NAME: 'panerelay',
    },
    expiresAt: bootstrap.expiresAt,
    concurrencyKey: 'browser-use:panerelay',
  });
}
