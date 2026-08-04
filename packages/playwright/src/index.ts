#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  CLI_ADAPTER_MAX_MESSAGE_BYTES,
  PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
  parseCliAdapterRequest,
  serializeCliAdapterMessage,
  type CliAdapterDoctorResult,
  type CliAdapterManifest,
  type CliAdapterRequest,
  type CliAdapterResponse,
  type CliAdapterSuccessResponse,
} from '@panerelay/protocol';
import { playwrightGatewayUrl } from './environment.js';

export const PLAYWRIGHT_ADAPTER_ID = 'playwright' as const;
export const PLAYWRIGHT_MINIMUM_VERSION = '0.1.17' as const;
export const PLAYWRIGHT_CHILD_ENVIRONMENT_KEYS = ['PLAYWRIGHT_MCP_CDP_ENDPOINT'] as const;
const executeFile = promisify(execFile);
const WINDOWS_COMMAND_META_CHARACTERS = /([()%!^"`<>&|;, *?])/g;

export interface PlaywrightInstallation {
  executable?: string;
  version?: string;
  supported: boolean;
}
export interface PlaywrightAdapterDependencies {
  adapterVersion?: string;
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  probeInstallation?: () => Promise<PlaywrightInstallation>;
}

function versionParts(value: string | undefined): readonly number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value ?? '');
  return match ? match.slice(1).map(Number) : null;
}

function escapeWindowsCommand(value: string): string {
  return value.replace(WINDOWS_COMMAND_META_CHARACTERS, '^$1');
}

function escapeWindowsArgument(value: string): string {
  const escapedQuotes = value
    .replace(/(?=(\\+?)?)\1"/g, '$1$1\\"')
    .replace(/(?=(\\+?)?)\1$/, '$1$1');
  return `"${escapedQuotes}"`.replace(WINDOWS_COMMAND_META_CHARACTERS, '^$1');
}

export function playwrightVersionInvocation(
  executable: string,
  environment: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): { command: string; args: string[]; windowsVerbatimArguments?: boolean } {
  if (platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable)) {
    const shellCommand = [
      escapeWindowsCommand(executable),
      escapeWindowsArgument('--version'),
    ].join(' ');
    return {
      command: environment.ComSpec ?? environment.COMSPEC ?? 'cmd.exe',
      args: ['/d', '/s', '/c', `"${shellCommand}"`],
      windowsVerbatimArguments: true,
    };
  }
  return { command: executable, args: ['--version'] };
}

export function isPlaywrightVersionAtLeast(value: string | undefined): boolean {
  const current = versionParts(value);
  const minimum = versionParts(PLAYWRIGHT_MINIMUM_VERSION);
  if (!current || !minimum) return false;
  return (
    current[0]! > minimum[0]! ||
    (current[0] === minimum[0] &&
      (current[1]! > minimum[1]! || (current[1] === minimum[1] && current[2]! >= minimum[2]!)))
  );
}

async function resolveExecutable(
  environment: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): Promise<string | null> {
  const executable = environment.PANERELAY_PLAYWRIGHT_EXECUTABLE ?? 'playwright-cli';
  const implementation = platform === 'win32' ? path.win32 : path.posix;
  const extensions =
    platform === 'win32'
      ? (environment.PATHEXT ?? '.COM;.EXE;.CMD;.BAT').split(';').concat('')
      : [''];
  if (implementation.isAbsolute(executable)) {
    try {
      await access(executable);
      return executable;
    } catch {
      return null;
    }
  }
  const pathKey = Object.keys(environment).find(key => key.toLowerCase() === 'path');
  for (const directory of ((pathKey && environment[pathKey]) ?? '')
    .split(implementation.delimiter)
    .filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = implementation.join(directory, `${executable}${extension}`);
      try {
        await access(candidate);
        return candidate;
      } catch {
        /* next candidate */
      }
    }
  }
  return null;
}

export async function probePlaywrightInstallation(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<PlaywrightInstallation> {
  const executable = await resolveExecutable(environment, platform);
  if (!executable) return { supported: false };
  try {
    const invocation = playwrightVersionInvocation(executable, environment, platform);
    const result = await executeFile(invocation.command, invocation.args, {
      env: environment,
      timeout: 3_000,
      maxBuffer: 2_048,
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    });
    const version =
      /(?:Playwright CLI|playwright-cli)\s+v?(\d+\.\d+\.\d+)/i.exec(result.stdout)?.[1] ??
      /v?(\d+\.\d+\.\d+)/.exec(result.stdout)?.[1];
    return {
      executable,
      ...(version ? { version } : {}),
      supported: isPlaywrightVersionAtLeast(version),
    };
  } catch {
    return { executable, supported: false };
  }
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

export function playwrightAdapterManifest(version: string): CliAdapterManifest {
  return {
    adapterId: PLAYWRIGHT_ADAPTER_ID,
    name: 'Panerelay Playwright connection adapter',
    version,
    protocol: PANERELAY_CLI_ADAPTER_PROTOCOL_VERSION,
    capabilities: ['connection.resolve', 'adapter.doctor'],
    modes: ['direct', 'extension'],
    childEnvironmentKeys: [...PLAYWRIGHT_CHILD_ENVIRONMENT_KEYS],
  };
}

async function doctor(
  dependencies: PlaywrightAdapterDependencies,
): Promise<CliAdapterDoctorResult> {
  const installation = await (
    dependencies.probeInstallation ??
    (() => probePlaywrightInstallation(dependencies.environment, dependencies.platform))
  )();
  return {
    status: installation.supported ? 'ready' : 'unavailable',
    checks: [
      {
        id: 'node-runtime',
        status: Number(process.versions.node.split('.')[0]) >= 20 ? 'pass' : 'fail',
        version: process.versions.node,
      },
      {
        id: 'playwright-cli',
        status: installation.supported ? 'pass' : 'fail',
        ...(installation.version ? { version: installation.version } : {}),
        ...(!installation.supported
          ? { message: `Playwright CLI ${PLAYWRIGHT_MINIMUM_VERSION} or newer is required` }
          : {}),
      },
    ],
  };
}

export async function handlePlaywrightAdapterRequest(
  request: CliAdapterRequest,
  dependencies: PlaywrightAdapterDependencies = {},
): Promise<CliAdapterResponse> {
  const version = dependencies.adapterVersion ?? '0.4.0';
  if (request.operation === 'adapter.manifest')
    return success(request, playwrightAdapterManifest(version));
  if (request.operation === 'adapter.doctor') return success(request, await doctor(dependencies));
  if (request.input.mode === 'direct')
    return success(request, { mode: 'direct', connection: { kind: 'direct' }, environment: {} });
  const url = playwrightGatewayUrl(request.input.browser);
  return success(request, {
    mode: 'extension',
    connection: { kind: 'cdp-http', url },
    environment: { PLAYWRIGHT_MCP_CDP_ENDPOINT: url },
    concurrencyKey: 'playwright:panerelay',
  });
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > CLI_ADAPTER_MAX_MESSAGE_BYTES) throw new Error('Adapter request is too large');
    chunks.push(buffer);
  }
  const request = parseCliAdapterRequest(Buffer.concat(chunks).toString('utf8').trim());
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  process.stdout.write(
    serializeCliAdapterMessage(
      await handlePlaywrightAdapterRequest(request, { adapterVersion: packageJson.version }),
    ),
  );
}

export {
  PANERELAY_PLAYWRIGHT_GATEWAY_PATH,
  PANERELAY_PLAYWRIGHT_GATEWAY_URL,
  playwrightGatewayUrl,
  playwrightTargetGatewayUrl,
} from './environment.js';
function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  }
}

if (isMainModule()) {
  await main();
}
