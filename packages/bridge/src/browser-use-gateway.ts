import { createServer, type ServerResponse } from 'node:http';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { selectBrowserRegistration } from '@panerelay/browser-registry';
import { PANERELAY_PROTOCOL_VERSION } from '@panerelay/protocol';

export const PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL = 'panerelay.browser-use-gateway.v1' as const;
export const PANERELAY_BROWSER_USE_GATEWAY_PORT = 43827;
export const PANERELAY_BROWSER_USE_GATEWAY_PATH = '/cdp/browser-use';

export interface BrowserUseGatewayState {
  protocol: typeof PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL;
  port: number;
  pid: number;
  updatedAt: string;
}

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

async function proxyVersion(response: ServerResponse): Promise<void> {
  try {
    const selected = await selectBrowserRegistration();
    const bootstrap = await fetch(`http://127.0.0.1:${selected.state.port}/cdp/bootstrap`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${selected.state.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocol: PANERELAY_PROTOCOL_VERSION,
        browser: {
          browserId: selected.state.browserId,
          generation: selected.state.generation,
        },
        actor: { kind: 'automation', name: 'Browser Use', sessionLabel: 'panerelay' },
        engine: 'browser-use',
        laneKey: 'browser-use:panerelay',
        connectionPolicy: 'single',
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (bootstrap.status !== 201) {
      await json(response, bootstrap.status === 429 ? 429 : 503, {
        protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
        error: 'Panerelay Browser Use connection is unavailable',
      });
      return;
    }
    const created = (await bootstrap.json()) as { cdpUrl?: string };
    if (!created.cdpUrl) throw new Error('invalid bootstrap response');
    const version = await fetch(`${created.cdpUrl}/json/version`, {
      signal: AbortSignal.timeout(5_000),
    });
    const body = await version.text();
    response.writeHead(version.status, {
      'cache-control': 'no-store',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    });
    response.end(body);
  } catch {
    await json(response, 503, {
      protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
      error: 'Panerelay Browser Use connection is unavailable',
    });
  }
}

async function gatewayHealth(port: number): Promise<boolean> {
  const response = await fetch(`http://127.0.0.1:${port}/health`, {
    signal: AbortSignal.timeout(500),
  });
  if (!response.ok) return false;
  try {
    const body = (await response.json()) as Partial<BrowserUseGatewayState> & {
      ready?: boolean;
    };
    return body.protocol === PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL && body.ready === true;
  } catch {
    return false;
  }
}

export async function runBrowserUseGateway(
  options: { homeDirectory?: string } = {},
): Promise<void> {
  const homeDirectory = options.homeDirectory ?? homedir();
  const path = browserUseGatewayStatePath(homeDirectory);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'GET' && url.pathname === '/health' && url.search === '') {
      await json(response, 200, { protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL, ready: true });
      return;
    }
    if (
      request.method === 'GET' &&
      url.pathname === `${PANERELAY_BROWSER_USE_GATEWAY_PATH}/json/version` &&
      url.search === ''
    ) {
      await proxyVersion(response);
      return;
    }
    await json(response, 404, {
      protocol: PANERELAY_BROWSER_USE_GATEWAY_PROTOCOL,
      error: 'Unknown Panerelay Browser Use gateway endpoint',
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
  const temporary = `${path}.${process.pid}.tmp`;
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
  const child = spawn(process.execPath, [entry, '--browser-use-gateway'], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, HOME: homeDirectory, USERPROFILE: homeDirectory },
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
