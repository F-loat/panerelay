import { randomBytes } from 'node:crypto';
import { createServer, type ServerResponse } from 'node:http';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import {
  PANERELAY_BROWSER_ENV,
  PANERELAY_BROWSER_ID_ENV,
  selectBrowserRegistration,
  type BrowserRegistryOptions,
} from '@panerelay/browser-registry';
import {
  PANERELAY_BROWSER_USE_GATEWAY_PATH,
  parseBrowserUseGatewaySelection,
  type BrowserUseGatewaySelection,
} from '@panerelay/browser-use/environment';
import {
  parsePlaywrightGatewaySelection,
  type PlaywrightGatewayRouteSelection,
} from '@panerelay/playwright/environment';
import {
  conversationTargetSessionName,
  PANERELAY_PROTOCOL_VERSION,
  type CdpBootstrapRequest,
  type CdpBootstrapVersionMetadata,
} from '@panerelay/protocol';

export const PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL = 'panerelay.browser-use-gateway.v1' as const;
export const PANERELAY_BROWSER_USE_GATEWAY_PORT = 43827;
const MAX_GATEWAY_RESPONSE_BYTES = 16 * 1024;
const BOOTSTRAP_TICKET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface BrowserUseGatewayState {
  protocol: typeof PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL;
  port: number;
  pid: number;
  updatedAt: string;
}

export type BrowserUseGatewayStopResult = 'absent' | 'stopped' | 'remaining';

export function browserUseGatewayStatePath(homeDirectory = homedir()): string {
  return join(homeDirectory, '.panerelay', 'browser-use', 'gateway.json');
}

export function browserUseGatewayUrl(port = PANERELAY_BROWSER_USE_GATEWAY_PORT): string {
  return `http://127.0.0.1:${port}${PANERELAY_BROWSER_USE_GATEWAY_PATH}`;
}

async function json(response: ServerResponse, status: number, value: unknown): Promise<void> {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

function gatewayRegistryOptions(homeDirectory: string): BrowserRegistryOptions {
  return {
    defaultPath: join(homeDirectory, '.panerelay', 'browser-default.json'),
    environment: gatewaySelectionEnvironment(),
    legacyPath: join(homeDirectory, '.panerelay', 'bridge.json'),
    registryDirectory: join(homeDirectory, '.panerelay', 'browsers'),
  };
}

type GatewaySelection = BrowserUseGatewaySelection | PlaywrightGatewayRouteSelection;

export function automationGatewayBootstrapRequest(
  browser: { browserId: string; generation: string },
  selection: GatewaySelection | undefined,
  engine: 'browser-use' | 'playwright',
): CdpBootstrapRequest {
  const targetSelection = selection && 'targetId' in selection ? selection : undefined;
  const targetSession = targetSelection
    ? conversationTargetSessionName(targetSelection)
    : undefined;
  return {
    protocol: PANERELAY_PROTOCOL_VERSION,
    browser: { ...browser },
    actor: {
      kind: 'automation',
      name: engine === 'browser-use' ? 'Browser Use' : 'Playwright',
      sessionLabel: targetSession ?? 'panerelay',
    },
    engine,
    laneKey: targetSession ? `${engine}:${targetSession}` : `${engine}:panerelay`,
    connectionPolicy: 'single',
    ...(targetSelection ? { initialTargetId: targetSelection.targetId } : {}),
  };
}

export function automationGatewayFailureStatus(status: number): 409 | 429 | 503 {
  if (status === 409) return 409;
  if (status === 429) return 429;
  return 503;
}

function gatewaySelectionEnvironment(selection?: GatewaySelection): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment[PANERELAY_BROWSER_ID_ENV];
  delete environment[PANERELAY_BROWSER_ENV];
  if (selection) environment[PANERELAY_BROWSER_ID_ENV] = selection.browserId;
  return environment;
}

async function boundedText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_GATEWAY_RESPONSE_BYTES) {
    throw new Error('Gateway response exceeded the protocol limit');
  }
  if (!response.body) {
    const body = await response.text();
    if (Buffer.byteLength(body) > MAX_GATEWAY_RESPONSE_BYTES) {
      throw new Error('Gateway response exceeded the protocol limit');
    }
    return body;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_GATEWAY_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Gateway response exceeded the protocol limit');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8');
}

function controlledWebSocketUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    const queryKeys = [...url.searchParams.keys()];
    return (
      url.protocol === 'ws:' &&
      url.hostname === '127.0.0.1' &&
      url.port !== '' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname === '/cdp' &&
      url.searchParams.getAll('session').length === 1 &&
      url.searchParams.get('session') !== '' &&
      url.searchParams.getAll('token').length === 1 &&
      url.searchParams.get('token') !== '' &&
      queryKeys.every(key => key === 'session' || key === 'token') &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

function controlledVersionMetadata(value: unknown): value is CdpBootstrapVersionMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    'Browser',
    'Protocol-Version',
    'User-Agent',
    'V8-Version',
    'WebKit-Version',
    'webSocketDebuggerUrl',
  ].sort();
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key, index) => key === expectedKeys[index])
  ) {
    return false;
  }
  const metadata = value as Partial<CdpBootstrapVersionMetadata>;
  return (
    typeof metadata.Browser === 'string' &&
    metadata.Browser.length > 0 &&
    metadata.Browser.length <= 512 &&
    typeof metadata['Protocol-Version'] === 'string' &&
    metadata['Protocol-Version'].length > 0 &&
    metadata['Protocol-Version'].length <= 128 &&
    typeof metadata['User-Agent'] === 'string' &&
    metadata['User-Agent'].length > 0 &&
    metadata['User-Agent'].length <= 512 &&
    typeof metadata['V8-Version'] === 'string' &&
    metadata['V8-Version'].length > 0 &&
    metadata['V8-Version'].length <= 512 &&
    typeof metadata['WebKit-Version'] === 'string' &&
    metadata['WebKit-Version'].length > 0 &&
    metadata['WebKit-Version'].length <= 512 &&
    controlledWebSocketUrl(metadata.webSocketDebuggerUrl)
  );
}

function controlledBootstrapUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4_096) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port !== '' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname.startsWith('/cdp/bootstrap/') &&
      BOOTSTRAP_TICKET_PATTERN.test(url.pathname.slice('/cdp/bootstrap/'.length)) &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

async function proxyVersion(
  response: ServerResponse,
  homeDirectory: string,
  selection: GatewaySelection | undefined,
  engine: 'browser-use' | 'playwright',
): Promise<void> {
  const engineName = engine === 'browser-use' ? 'Browser Use' : 'Playwright';
  try {
    const selected = await selectBrowserRegistration({
      ...gatewayRegistryOptions(homeDirectory),
      environment: gatewaySelectionEnvironment(selection),
    });
    if (
      selection &&
      'generation' in selection &&
      selected.state.generation !== selection.generation
    ) {
      throw new Error('The selected browser connection changed; resolve it again');
    }
    const bootstrap = await fetch(`http://127.0.0.1:${selected.state.port}/cdp/bootstrap`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${selected.state.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(
        automationGatewayBootstrapRequest(
          {
            browserId: selected.state.browserId,
            generation: selected.state.generation,
          },
          selection,
          engine,
        ),
      ),
      signal: AbortSignal.timeout(5_000),
    });
    if (bootstrap.status !== 201) {
      await json(response, automationGatewayFailureStatus(bootstrap.status), {
        protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
        error: `Panerelay ${engineName} connection is unavailable`,
      });
      return;
    }
    const createdText = await boundedText(bootstrap);
    const created = JSON.parse(createdText) as { cdpUrl?: unknown };
    if (!controlledBootstrapUrl(created.cdpUrl)) throw new Error('invalid bootstrap response');
    const version = await fetch(`${created.cdpUrl}/json/version`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (version.status !== 200) {
      await json(response, automationGatewayFailureStatus(version.status), {
        protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
        error: `Panerelay ${engineName} connection is unavailable`,
      });
      return;
    }
    const metadata = JSON.parse(await boundedText(version)) as unknown;
    if (!controlledVersionMetadata(metadata))
      throw new Error(`invalid ${engineName} version response`);
    await json(response, 200, metadata);
  } catch {
    await json(response, 503, {
      protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
      error: `Panerelay ${engineName} connection is unavailable`,
    });
  }
}

async function gatewayHealthState(
  port: number,
): Promise<{ pid: number; protocol: typeof PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL } | null> {
  const response = await fetch(`http://127.0.0.1:${port}/health`, {
    signal: AbortSignal.timeout(500),
  });
  if (!response.ok) return null;
  try {
    const body = JSON.parse(await boundedText(response)) as Partial<BrowserUseGatewayState> & {
      ready?: boolean;
    };
    return body.protocol === PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL &&
      body.ready === true &&
      typeof body.pid === 'number' &&
      Number.isSafeInteger(body.pid) &&
      body.pid > 0
      ? { pid: body.pid, protocol: body.protocol }
      : null;
  } catch {
    return null;
  }
}

async function gatewayHealth(port: number): Promise<boolean> {
  return (await gatewayHealthState(port)) !== null;
}

export async function runBrowserUseGateway(
  options: { homeDirectory?: string } = {},
): Promise<void> {
  const homeDirectory = options.homeDirectory ?? homedir();
  const path = browserUseGatewayStatePath(homeDirectory);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'GET' && url.pathname === '/health' && url.search === '') {
      await json(response, 200, {
        pid: process.pid,
        protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
        ready: true,
      });
      return;
    }
    if (request.method === 'GET' && url.search === '') {
      const browserUseSelection = parseBrowserUseGatewaySelection(url.pathname);
      if (browserUseSelection !== null) {
        await proxyVersion(response, homeDirectory, browserUseSelection, 'browser-use');
        return;
      }
      const playwrightSelection = parsePlaywrightGatewaySelection(url.pathname);
      if (playwrightSelection !== null) {
        await proxyVersion(response, homeDirectory, playwrightSelection, 'playwright');
        return;
      }
    }
    await json(response, 404, {
      protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
      error: 'Unknown Panerelay automation gateway endpoint',
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(PANERELAY_BROWSER_USE_GATEWAY_PORT, '127.0.0.1', resolve);
  });
  await mkdir(join(homeDirectory, '.panerelay', 'browser-use'), { recursive: true, mode: 0o700 });
  const state: BrowserUseGatewayState = {
    protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
    port: PANERELAY_BROWSER_USE_GATEWAY_PORT,
    pid: process.pid,
    updatedAt: new Date().toISOString(),
  };
  const temporary = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
  const cleanup = async () => {
    try {
      const current = JSON.parse(await readFile(path, 'utf8')) as Partial<BrowserUseGatewayState>;
      if (current.pid === process.pid) await rm(path, { force: true });
    } catch {
      // The state may already have been removed or replaced by a newer owner.
    }
    server.close();
  };
  process.once('SIGTERM', () => void cleanup().finally(() => process.exit(0)));
  process.once('SIGINT', () => void cleanup().finally(() => process.exit(0)));
}

export async function stopBrowserUseGateway(
  options: { homeDirectory?: string } = {},
): Promise<BrowserUseGatewayStopResult> {
  const homeDirectory = options.homeDirectory ?? homedir();
  const path = browserUseGatewayStatePath(homeDirectory);
  let state: Partial<BrowserUseGatewayState>;
  try {
    state = JSON.parse(await readFile(path, 'utf8')) as Partial<BrowserUseGatewayState>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'absent';
    return 'remaining';
  }
  if (
    state.protocol !== PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL ||
    state.port !== PANERELAY_BROWSER_USE_GATEWAY_PORT ||
    typeof state.pid !== 'number' ||
    !Number.isSafeInteger(state.pid) ||
    state.pid <= 0
  ) {
    return 'remaining';
  }
  let health: { pid: number } | null;
  try {
    health = await gatewayHealthState(state.port);
  } catch {
    health = null;
  }
  if (!health || health.pid !== state.pid) return 'remaining';
  try {
    process.kill(state.pid, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return 'remaining';
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      if (!(await gatewayHealth(state.port))) return 'stopped';
    } catch {
      return 'stopped';
    }
  }
  return 'remaining';
}

export async function ensureBrowserUseGateway(
  options: { homeDirectory?: string } = {},
): Promise<string> {
  const homeDirectory = options.homeDirectory ?? homedir();
  const path = browserUseGatewayStatePath(homeDirectory);
  try {
    const state = JSON.parse(await readFile(path, 'utf8')) as BrowserUseGatewayState;
    if (
      state.protocol === PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL &&
      state.port === PANERELAY_BROWSER_USE_GATEWAY_PORT &&
      (await gatewayHealth(state.port))
    ) {
      return browserUseGatewayUrl(state.port);
    }
  } catch {
    // Start or recover the gateway below.
  }
  const entry = process.argv[1];
  if (!entry) throw new Error('Panerelay Browser Use gateway entrypoint is unavailable');
  const gatewayEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: homeDirectory,
    USERPROFILE: homeDirectory,
  };
  delete gatewayEnvironment[PANERELAY_BROWSER_ID_ENV];
  delete gatewayEnvironment[PANERELAY_BROWSER_ENV];
  const child = spawn(process.execPath, [entry, '--browser-use-gateway'], {
    detached: true,
    stdio: 'ignore',
    env: gatewayEnvironment,
  });
  child.unref();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      const state = JSON.parse(await readFile(path, 'utf8')) as BrowserUseGatewayState;
      if (
        state.protocol === PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL &&
        state.port === PANERELAY_BROWSER_USE_GATEWAY_PORT &&
        (await gatewayHealth(state.port))
      ) {
        return browserUseGatewayUrl(state.port);
      }
    } catch {
      // Keep waiting for the detached gateway to bind.
    }
  }
  throw new Error('Panerelay Browser Use gateway did not become ready');
}
