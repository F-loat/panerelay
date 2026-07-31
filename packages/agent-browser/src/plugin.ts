import { readFile } from 'node:fs/promises';
import {
  PANERELAY_PROTOCOL_VERSION,
  type BridgeState,
  type RelaySessionCreated,
  type RelaySessionError,
} from '@panerelay/protocol';
import { bridgeStatePath } from '@panerelay/protocol/node';

export const AGENT_BROWSER_PLUGIN_PROTOCOL = 'agent-browser.plugin.v1' as const;

interface PluginRequest {
  protocol?: unknown;
  type?: unknown;
  capability?: unknown;
  request?: unknown;
}

interface PluginResponse {
  protocol: typeof AGENT_BROWSER_PLUGIN_PROTOCOL;
  success: boolean;
  [key: string]: unknown;
}

interface BrowserCleanup {
  bridgePid: number;
  browserId: string;
  sessionId: string;
}

function success(body: Record<string, unknown>): PluginResponse {
  return {
    protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
    success: true,
    ...body,
  };
}

function failure(error: string): PluginResponse {
  return {
    protocol: AGENT_BROWSER_PLUGIN_PROTOCOL,
    success: false,
    error,
  };
}

async function readLiveBridgeState(): Promise<BridgeState> {
  let state: BridgeState;
  try {
    state = JSON.parse(await readFile(bridgeStatePath(), 'utf8')) as BridgeState;
  } catch {
    throw new Error(
      'Panerelay Bridge is unavailable. Build and load the extension, then authorize a tab.',
    );
  }

  if (
    state.protocol !== PANERELAY_PROTOCOL_VERSION ||
    typeof state.pid !== 'number' ||
    typeof state.port !== 'number' ||
    typeof state.token !== 'string'
  ) {
    throw new Error('Panerelay Bridge state is invalid or incompatible');
  }

  try {
    process.kill(state.pid, 0);
  } catch {
    throw new Error('Panerelay Bridge state is stale; reopen the extension and retry');
  }

  return state;
}

function sessionLabel(request: unknown): string | undefined {
  if (!request || typeof request !== 'object') return undefined;
  const value = (request as { session?: unknown }).session;
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 128) : undefined;
}

async function createRelaySession(
  state: BridgeState,
  request: unknown,
): Promise<RelaySessionCreated> {
  if (state.capabilities?.cdpRelay === false) {
    throw new Error(
      `${state.browserName} does not support Panerelay browser automation because its Extension cannot provide a CDP relay`,
    );
  }
  const label = sessionLabel(request);
  const response = await fetch(`http://127.0.0.1:${state.port}/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${state.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      protocol: PANERELAY_PROTOCOL_VERSION,
      actor: {
        kind: 'automation',
        name: 'agent-browser',
        ...(label ? { sessionLabel: label } : {}),
      },
    }),
    signal: AbortSignal.timeout(5_000),
  });
  const body = (await response.json()) as Partial<RelaySessionCreated & RelaySessionError>;
  if (
    response.status !== 201 ||
    body.protocol !== PANERELAY_PROTOCOL_VERSION ||
    typeof body.sessionId !== 'string' ||
    typeof body.cdpUrl !== 'string' ||
    typeof body.connectExpiresAt !== 'string'
  ) {
    throw new Error(body.error || `Panerelay Bridge rejected the session (${response.status})`);
  }
  return body as RelaySessionCreated;
}

function browserCleanup(value: unknown): BrowserCleanup | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<BrowserCleanup>;
  if (
    typeof candidate.bridgePid !== 'number' ||
    typeof candidate.browserId !== 'string' ||
    typeof candidate.sessionId !== 'string'
  ) {
    return null;
  }
  return candidate as BrowserCleanup;
}

async function releaseRelaySession(value: unknown): Promise<void> {
  const cleanup = browserCleanup(value);
  if (!cleanup) return;

  let state: BridgeState;
  try {
    state = await readLiveBridgeState();
  } catch {
    return;
  }
  if (state.pid !== cleanup.bridgePid || state.browserId !== cleanup.browserId) return;

  const response = await fetch(
    `http://127.0.0.1:${state.port}/sessions/${encodeURIComponent(cleanup.sessionId)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${state.token}` },
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (response.status !== 204 && response.status !== 404) {
    throw new Error(`Panerelay Bridge could not release the session (${response.status})`);
  }
}

export async function handlePluginRequest(input: PluginRequest): Promise<PluginResponse> {
  if (input.protocol !== AGENT_BROWSER_PLUGIN_PROTOCOL) {
    return failure('Unsupported plugin protocol');
  }

  if (input.type === 'plugin.manifest') {
    return success({
      manifest: {
        name: 'panerelay',
        capabilities: ['browser.provider'],
        description:
          "Connect agent-browser to a user's authorized Chrome targets through Panerelay.",
      },
    });
  }

  if (input.type === 'browser.close') {
    try {
      await releaseRelaySession(input.request);
      return success({ data: {} });
    } catch (error) {
      return failure(error instanceof Error ? error.message : String(error));
    }
  }

  if (input.type !== 'browser.launch' || input.capability !== 'browser.provider') {
    return failure(`Unsupported request type: ${String(input.type)}`);
  }

  try {
    const state = await readLiveBridgeState();
    const session = await createRelaySession(state, input.request);
    return success({
      browser: {
        cdpUrl: session.cdpUrl,
        directPage: false,
        metadata: {
          browserId: state.browserId,
          browserName: state.browserName,
          extensionVersion: state.extensionVersion,
          relaySessionId: session.sessionId,
          connectExpiresAt: session.connectExpiresAt,
        },
        cleanup: {
          bridgePid: state.pid,
          browserId: state.browserId,
          sessionId: session.sessionId,
        },
      },
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}
