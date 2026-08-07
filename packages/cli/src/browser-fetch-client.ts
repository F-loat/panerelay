import {
  PANERELAY_FETCH_SESSION_PROTOCOL,
  PANERELAY_FETCH_PERMISSION_PROTOCOL,
  isBrowserFetchRequest,
  isBrowserFetchPermissionError,
  isBrowserFetchPermissionResult,
  isBrowserFetchResponse,
  isBrowserFetchSessionCreated,
  isBrowserFetchSessionError,
  type BrowserFetchRequest,
  type BrowserFetchPermissionResult,
  type BrowserFetchResponse,
  type BrowserFetchSessionCreated,
  type BridgeState,
} from '@panerelay/protocol';

export type BrowserFetchHttpClient = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface BrowserFetchClientOptions {
  fetch?: BrowserFetchHttpClient;
}

export interface ActiveBrowserFetchSession {
  state: BridgeState;
  session: BrowserFetchSessionCreated;
}

function httpClient(options: BrowserFetchClientOptions): BrowserFetchHttpClient {
  return options.fetch ?? fetch;
}

function boundedJsonPayload(value: string, maximumBytes: number): unknown {
  if (Buffer.byteLength(value) > maximumBytes) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function responseError(
  response: Response,
  payload: unknown,
  fallback: string,
  secrets: string[],
): Error {
  const detail = secrets.reduce(
    (current, secret) => (secret ? current.replaceAll(secret, '[redacted]') : current),
    isBrowserFetchSessionError(payload) || isBrowserFetchPermissionError(payload)
      ? payload.error
      : fallback,
  );
  return new Error(`${detail} (Bridge HTTP ${response.status})`);
}

export async function requestBrowserFetchPermission(
  state: BridgeState,
  domain: string,
  options: BrowserFetchClientOptions = {},
): Promise<BrowserFetchPermissionResult> {
  const response = await httpClient(options)(`http://127.0.0.1:${state.port}/fetch/permissions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${state.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
      browser: { browserId: state.browserId, generation: state.generation },
      domain,
    }),
  });
  const payload = boundedJsonPayload(await response.text(), 4_096);
  if (!response.ok) {
    throw responseError(response, payload, 'Unable to request browser fetch authorization', [
      state.token,
    ]);
  }
  if (!isBrowserFetchPermissionResult(payload)) {
    throw new Error('Panerelay Bridge returned an invalid browser fetch authorization result');
  }
  return payload;
}

export async function createBrowserFetchSession(
  state: BridgeState,
  options: BrowserFetchClientOptions = {},
): Promise<ActiveBrowserFetchSession> {
  const response = await httpClient(options)(`http://127.0.0.1:${state.port}/fetch/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${state.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
      browser: { browserId: state.browserId, generation: state.generation },
    }),
  });
  const payload = boundedJsonPayload(await response.text(), 4_096);
  if (!response.ok) {
    throw responseError(response, payload, 'Unable to create browser fetch session', [state.token]);
  }
  if (!isBrowserFetchSessionCreated(payload)) {
    throw new Error('Panerelay Bridge returned an invalid browser fetch session');
  }
  const endpoint = new URL(payload.endpoint);
  if (endpoint.hostname !== '127.0.0.1' || Number(endpoint.port) !== state.port) {
    throw new Error('Panerelay Bridge returned a fetch endpoint for a different listener');
  }
  return { state, session: payload };
}

export async function releaseBrowserFetchSession(
  active: ActiveBrowserFetchSession,
  options: BrowserFetchClientOptions = {},
): Promise<void> {
  const endpoint = new URL(active.session.endpoint);
  const response = await httpClient(options)(
    `${endpoint.origin}/fetch/sessions/${encodeURIComponent(active.session.sessionId)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${active.state.token}` },
    },
  );
  if (!response.ok) throw new Error(`Unable to release browser fetch session (${response.status})`);
}

export async function runBrowserFetchInSession(
  active: ActiveBrowserFetchSession,
  request: BrowserFetchRequest,
  options: BrowserFetchClientOptions = {},
): Promise<BrowserFetchResponse> {
  if (!isBrowserFetchRequest(request)) throw new Error('Invalid browser fetch request');
  if (Date.parse(active.session.expiresAt) <= Date.now()) {
    throw new Error('Panerelay browser fetch session expired');
  }
  const response = await httpClient(options)(active.session.endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${active.session.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  const responseText = await response.text();
  const payload = boundedJsonPayload(responseText, response.ok ? 48 * 1024 * 1024 : 4_096);
  if (!response.ok) {
    throw responseError(response, payload, 'Browser fetch failed', [
      active.state.token,
      active.session.token,
    ]);
  }
  if (!isBrowserFetchResponse(payload)) {
    throw new Error('Panerelay Bridge returned an invalid browser fetch response');
  }
  return payload;
}

export async function runBrowserFetch(
  state: BridgeState,
  request: BrowserFetchRequest,
  options: BrowserFetchClientOptions = {},
): Promise<BrowserFetchResponse> {
  const active = await createBrowserFetchSession(state, options);
  try {
    return await runBrowserFetchInSession(active, request, options);
  } finally {
    await releaseBrowserFetchSession(active, options).catch(() => undefined);
  }
}
