import {
  readLiveBrowserRegistration,
  readLiveLegacyBrowserRegistration,
  selectBrowserRegistration,
} from '@panerelay/browser-registry';
import {
  PANERELAY_PROTOCOL_VERSION,
  PANERELAY_CONVERSATION_TARGET_SESSION_PREFIX,
  PANERELAY_LEGACY_CONVERSATION_TARGET_SESSION_PREFIX,
  parseConversationTargetSessionName,
  type BridgeState,
  type RelaySessionCreated,
  type RelaySessionError,
} from '@panerelay/protocol';

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
  legacy?: boolean;
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

function sessionLabel(request: unknown): string | undefined {
  if (!request || typeof request !== 'object') return undefined;
  const value = (request as { session?: unknown }).session;
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 128) : undefined;
}

async function createRelaySession(
  state: BridgeState,
  request: unknown,
  initialTargetId?: string,
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
      ...(initialTargetId ? { initialTargetId } : {}),
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
    (candidate.legacy !== undefined && typeof candidate.legacy !== 'boolean') ||
    typeof candidate.sessionId !== 'string'
  ) {
    return null;
  }
  return candidate as BrowserCleanup;
}

async function releaseRelaySession(value: unknown): Promise<void> {
  const cleanup = browserCleanup(value);
  if (!cleanup) return;

  const state = cleanup.legacy
    ? await readLiveLegacyBrowserRegistration({})
    : await readLiveBrowserRegistration(cleanup.browserId);
  if (!state) return;
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
          "Connect agent-browser to a user's selected authorized Chrome or Edge browser through Panerelay.",
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
    const label = sessionLabel(input.request);
    const target = label ? parseConversationTargetSessionName(label) : undefined;
    if (
      label &&
      !target &&
      (label.startsWith(PANERELAY_CONVERSATION_TARGET_SESSION_PREFIX) ||
        label.startsWith(PANERELAY_LEGACY_CONVERSATION_TARGET_SESSION_PREFIX))
    ) {
      throw new Error('The Panerelay conversation target session is malformed or unsupported');
    }
    const selection = target ? undefined : await selectBrowserRegistration();
    const state = target ? await readLiveBrowserRegistration(target.browserId) : selection!.state;
    if (!state) {
      throw new Error('The Panerelay conversation browser is no longer available');
    }
    const session = await createRelaySession(state, input.request, target?.targetId);
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
          ...(selection?.source === 'legacy' ? { legacy: true } : {}),
          sessionId: session.sessionId,
        },
      },
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}
