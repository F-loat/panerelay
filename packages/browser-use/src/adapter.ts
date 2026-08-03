import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  type CliAdapterDoctorResult,
  type CliAdapterManifest,
  type CliAdapterRequest,
  type CliAdapterResponse,
  type CliAdapterSuccessResponse,
} from '@panerelay/protocol';
import { browserUseGatewayUrl } from './environment.js';

export const BROWSER_USE_ADAPTER_ID = 'browser-use' as const;
export const BROWSER_USE_MINIMUM_VERSION = '0.13.7' as const;
const BROWSER_HARNESS_MINIMUM_VERSION = '0.1.8' as const;
export const BROWSER_USE_CHILD_ENVIRONMENT_KEYS = [
  'ANONYMIZED_TELEMETRY',
  'BH_RECORD',
  'BH_TELEMETRY',
  'BU_CDP_URL',
  'BU_NAME',
] as const;

const executeFile = promisify(execFile);

interface PythonInvocation {
  args: string[];
  command: string;
}

export interface BrowserUseVersions {
  browserUseExecutable?: string;
  browserUse?: string;
  browserHarness?: string;
}

export type BrowserUseInstallationStatus =
  'ready' | 'not-found' | 'unsupported-version' | 'incomplete';

function stableVersionParts(version: string | undefined): readonly number[] | null {
  if (!version) return null;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\+[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) return null;
  const parts = match.slice(1).map(value => Number.parseInt(value!, 10));
  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function isStableVersionAtLeast(version: string | undefined, minimum: string): boolean {
  const current = stableVersionParts(version);
  const required = stableVersionParts(minimum);
  if (!current || !required) return false;
  for (let index = 0; index < required.length; index += 1) {
    if (current[index]! > required[index]!) return true;
    if (current[index]! < required[index]!) return false;
  }
  return true;
}

export function browserUseInstallationStatus(
  versions: BrowserUseVersions,
): BrowserUseInstallationStatus {
  if (!versions.browserUseExecutable) return 'not-found';
  if (!versions.browserUse) return 'incomplete';
  if (!isStableVersionAtLeast(versions.browserUse, BROWSER_USE_MINIMUM_VERSION)) {
    return 'unsupported-version';
  }
  if (!isStableVersionAtLeast(versions.browserHarness, BROWSER_HARNESS_MINIMUM_VERSION)) {
    return 'incomplete';
  }
  return 'ready';
}

export function isBrowserUseInstallationSupported(versions: BrowserUseVersions): boolean {
  return browserUseInstallationStatus(versions) === 'ready';
}

export interface BrowserUseAdapterDependencies {
  adapterVersion?: string;
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  probeVersions?: () => Promise<BrowserUseVersions>;
  homeDirectory?: string;
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
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const accessMode = platform === 'win32' ? constants.F_OK : constants.X_OK;
  if (paths.isAbsolute(executable)) {
    try {
      await access(executable, accessMode);
      return executable;
    } catch {
      return null;
    }
  }
  const extensions =
    platform === 'win32'
      ? (environment.PATHEXT ?? '.COM;.EXE;.CMD;.BAT').split(';').filter(Boolean).concat('')
      : [''];
  for (const directory of (environment.PATH ?? '').split(paths.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = paths.join(directory, `${executable}${extension}`);
      try {
        await access(candidate, accessMode);
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
): Promise<PythonInvocation | null> {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const configured = environment.PANERELAY_BROWSER_USE_PYTHON;
  if (configured && paths.isAbsolute(configured)) {
    const command = await resolveExecutable(configured, environment, platform);
    return command ? { command, args: [] } : null;
  }
  if (platform === 'win32') {
    const command = await resolveExecutable(
      paths.join(paths.dirname(executablePath), 'python.exe'),
      environment,
      platform,
    );
    return command ? { command, args: [] } : null;
  }
  try {
    const header = (await readFile(executablePath, 'utf8')).slice(0, 512);
    const shebang = /^#!([^\r\n]+)/.exec(header)?.[1]?.trim();
    if (!shebang) return null;
    const [interpreter, ...interpreterArgs] = shebang.split(/\s+/);
    if (!interpreter || !paths.isAbsolute(interpreter)) return null;
    if (paths.basename(interpreter) !== 'env') {
      const command = await resolveExecutable(interpreter, environment, platform);
      return command ? { command, args: interpreterArgs } : null;
    }
    const envArgs = interpreterArgs[0] === '-S' ? interpreterArgs.slice(1) : interpreterArgs;
    const [target, ...targetArgs] = envArgs;
    if (!target || target.startsWith('-')) return null;
    const command = await resolveExecutable(target, environment, platform);
    return command ? { command, args: targetArgs } : null;
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
      python.command,
      [
        ...python.args,
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
  const installationStatus = browserUseInstallationStatus(versions);
  const browserUseReady = installationStatus === 'ready';
  return {
    status: browserUseReady ? 'ready' : 'unavailable',
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
              message:
                installationStatus === 'not-found'
                  ? 'Browser Use was not found'
                  : installationStatus === 'unsupported-version'
                    ? `Browser Use ${BROWSER_USE_MINIMUM_VERSION} or newer is required`
                    : `Browser Use installation is incomplete; reinstall or upgrade Browser Use ${BROWSER_USE_MINIMUM_VERSION} or newer`,
            }
          : {}),
      },
    ],
  };
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
  const gatewayUrl = browserUseGatewayUrl(request.input.browser);
  return success(request, {
    mode: 'extension',
    connection: { kind: 'cdp-http', url: gatewayUrl },
    environment: {
      ANONYMIZED_TELEMETRY: 'false',
      BH_RECORD: '0',
      BH_TELEMETRY: '0',
      BU_CDP_URL: gatewayUrl,
      BU_NAME: 'panerelay',
    },
    concurrencyKey: 'browser-use:panerelay',
  });
}
