import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  PANERELAY_PROTOCOL_VERSION,
  classifyCdpMethod,
  type AutomationActivity,
  type AutomationActivityFailure,
  type AutomationActivityStatus,
  type BrowserRegistration,
  type CdpAttachedMessage,
  type CdpDetachedMessage,
  type CdpEventMessage,
  type CdpResultMessage,
  type CdpTargetEventMessage,
  type CdpTargetInfo,
  type CdpTargetOperation,
  type CdpTargetResultMessage,
  type ExtensionToHostMessage,
  type HostToExtensionMessage,
  type RelaySessionActor,
  type RelaySessionCreateRequest,
  type RelaySessionCreated,
  type RelaySessionError,
  type ControlSessionChangedMessage,
  type ControlSessionState,
} from '@panerelay/protocol';
import WebSocket, { WebSocketServer } from 'ws';

interface PendingExtensionResult<T> {
  resolve: (result: T) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface PendingCommand {
  client: WebSocket;
  cdpId: number;
  sessionId?: string;
}

interface ActiveRelaySession {
  id: string;
  token: string;
  actor: RelaySessionActor;
  connectExpiresAt: number;
  connectedAt?: number;
  lastHeartbeatAt?: number;
}

interface PageSession {
  id: string;
  targetId: string;
  client: WebSocket;
}

interface ClientState {
  discoverTargets: boolean;
  sessions: Set<string>;
  lastSeenAt: number;
}

interface ChildSession {
  targetId: string;
}

const MAX_LEASE_CONNECTIONS = 4;
const CDP_PROTOCOL_VERSION = '1.3';
const DEFAULT_SESSION_CONNECT_TIMEOUT_MS = 30_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 35_000;
const EXTENSION_REQUEST_TIMEOUT_MS = 10_000;
const MAX_SESSION_REQUEST_BYTES = 16 * 1024;
const MAX_ACTIVITY_RECORDS = 100;
const BROWSER_COOKIE_METHODS = new Set([
  'Network.getAllCookies',
  'Network.clearBrowserCookies',
  'Storage.getCookies',
  'Storage.clearCookies',
]);

class RelayHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface BrowserRelayOptions {
  sendToExtension: (message: HostToExtensionMessage) => void;
  onBrowserRegistered: (browser: BrowserRegistration) => void | Promise<void>;
  onBrowserDisconnected: () => void | Promise<void>;
  extensionRequestTimeoutMs?: number;
  sessionConnectTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
}

export class BrowserRelay {
  readonly port: number;
  readonly token = randomBytes(32).toString('base64url');

  private readonly clients = new Map<WebSocket, ClientState>();
  private readonly targets = new Map<string, CdpTargetInfo>();
  private readonly pageSessions = new Map<string, PageSession>();
  private readonly childSessions = new Map<string, ChildSession>();
  private readonly attachedTargets = new Set<string>();
  private readonly attachPromises = new Map<string, Promise<void>>();
  private readonly pendingAttaches = new Map<string, PendingExtensionResult<CdpAttachedMessage>>();
  private readonly pendingTargetRequests = new Map<
    string,
    PendingExtensionResult<CdpTargetResultMessage>
  >();
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private readonly clientActivities = new Map<WebSocket, Map<number, string>>();
  private readonly activities: AutomationActivity[] = [];
  private readonly activityEpoch = randomUUID();
  private browser: BrowserRegistration | null = null;
  private activeSession: ActiveRelaySession | null = null;
  private sessionExpiryTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private controlSequence = 0;
  private lastHeartbeatStatusAt = 0;
  private lastSessionMessage: ControlSessionChangedMessage | null = null;

  private constructor(
    private readonly server: WebSocketServer,
    private readonly httpServer: Server,
    private readonly options: BrowserRelayOptions,
    port: number,
  ) {
    this.port = port;
    this.server.on('connection', (client, request) => this.handleConnection(client, request));
    this.httpServer.on('request', (request, response) => {
      void this.handleHttpRequest(request, response).catch(error => {
        const status = error instanceof RelayHttpError ? error.status : 500;
        this.sendJson(response, status, {
          protocol: PANERELAY_PROTOCOL_VERSION,
          error:
            error instanceof RelayHttpError ? error.message : 'PaneRelay Bridge request failed',
        });
      });
    });
    this.httpServer.on('upgrade', (request, socket, head) => {
      this.server.handleUpgrade(request, socket, head, client => {
        this.server.emit('connection', client, request);
      });
    });
  }

  static async listen(options: BrowserRelayOptions): Promise<BrowserRelay> {
    const httpServer = createServer();
    const server = new WebSocketServer({ noServer: true });
    await new Promise<void>((resolve, reject) => {
      httpServer.once('listening', resolve);
      httpServer.once('error', reject);
      httpServer.listen(0, '127.0.0.1');
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('PaneRelay Bridge did not receive a TCP address');
    }
    return new BrowserRelay(server, httpServer, options, address.port);
  }

  async handleExtensionMessage(message: ExtensionToHostMessage): Promise<void> {
    switch (message.type) {
      case 'browser.register':
        this.browser = {
          browserId: message.browserId,
          browserName: message.browserName,
          extensionVersion: message.extensionVersion,
        };
        await this.options.onBrowserRegistered(this.browser);
        this.options.sendToExtension({
          type: 'browser.registered',
          protocol: PANERELAY_PROTOCOL_VERSION,
          browserId: message.browserId,
        });
        this.sendControlSnapshot();
        return;
      case 'cdp.target.result':
        this.resolveTargetRequest(message);
        return;
      case 'cdp.target.event':
        this.handleTargetEvent(message);
        return;
      case 'cdp.attached':
        this.resolveAttach(message);
        return;
      case 'cdp.result':
        this.forwardResult(message);
        return;
      case 'cdp.event':
        this.forwardEvent(message);
        return;
      case 'cdp.detached':
        this.handleDetached(message);
        return;
    }
  }

  async close(reason = 'Bridge shutting down'): Promise<void> {
    this.revokeActiveSession(reason, 1012, true, 'failed');
    this.rejectExtensionRequests(new Error(reason));
    await new Promise<void>(resolve => this.server.close(() => resolve()));
    await new Promise<void>(resolve => this.httpServer.close(() => resolve()));
    this.browser = null;
    await this.options.onBrowserDisconnected();
  }

  private handleConnection(client: WebSocket, request: IncomingMessage): void {
    if (!this.isAuthorizedCdpRequest(request)) {
      client.close(1008, 'Invalid PaneRelay session token');
      return;
    }
    if (!this.browser) {
      client.close(1013, 'PaneRelay extension is not registered');
      return;
    }
    if (this.clients.size >= MAX_LEASE_CONNECTIONS) {
      client.close(1013, 'The PaneRelay lease has too many transport connections');
      return;
    }

    const now = Date.now();
    this.clients.set(client, {
      discoverTargets: false,
      sessions: new Set(),
      lastSeenAt: now,
    });
    if (this.activeSession) {
      this.activeSession.connectedAt ??= now;
      this.activeSession.lastHeartbeatAt = now;
    }
    this.lastHeartbeatStatusAt = now;
    this.clearSessionExpiryTimer();
    this.startHeartbeat();
    this.emitCurrentSessionState('connected');
    client.on('message', data => {
      this.touchClient(client);
      void this.handleClientMessage(client, data.toString()).catch(error => {
        this.sendProtocolError(
          client,
          null,
          error instanceof Error ? error.message : String(error),
        );
      });
    });
    client.on('pong', () => this.touchClient(client));
    client.on('close', () => this.handleClientClose(client));
    client.on('error', () => this.handleClientClose(client));
  }

  private isAuthorizedCdpRequest(request: IncomingMessage): boolean {
    try {
      const url = new URL(request.url || '/', 'ws://127.0.0.1');
      const session = this.activeSession;
      return (
        url.pathname === '/cdp' &&
        session !== null &&
        (session.connectedAt !== undefined || Date.now() <= session.connectExpiresAt) &&
        url.searchParams.get('session') === session.id &&
        url.searchParams.get('token') === session.token
      );
    } catch {
      return false;
    }
  }

  private async handleHttpRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (!this.isAuthorizedBootstrapRequest(request)) {
      this.sendJson(response, 401, {
        protocol: PANERELAY_PROTOCOL_VERSION,
        error: 'Invalid PaneRelay Bridge token',
      });
      return;
    }

    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method === 'POST' && url.pathname === '/sessions') {
      await this.handleCreateSession(request, response);
      return;
    }

    const sessionMatch = /^\/sessions\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'DELETE' && sessionMatch?.[1]) {
      if (this.activeSession?.id === decodeURIComponent(sessionMatch[1])) {
        this.revokeActiveSession('Automation provider released the session', 1000, true);
      }
      response.writeHead(204);
      response.end();
      return;
    }

    this.sendJson(response, 404, {
      protocol: PANERELAY_PROTOCOL_VERSION,
      error: 'Unknown PaneRelay Bridge endpoint',
    });
  }

  private isAuthorizedBootstrapRequest(request: IncomingMessage): boolean {
    return request.headers.authorization === `Bearer ${this.token}`;
  }

  private async handleCreateSession(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (!this.browser) {
      this.sendJson(response, 503, {
        protocol: PANERELAY_PROTOCOL_VERSION,
        error: 'PaneRelay extension is not registered',
      });
      return;
    }
    if (this.activeSession) {
      this.sendJson(response, 409, {
        protocol: PANERELAY_PROTOCOL_VERSION,
        error: 'The authorized browser already has an active relay session',
      });
      return;
    }

    const payload = await this.readJsonBody(request);
    if (!this.isSessionCreateRequest(payload)) {
      this.sendJson(response, 400, {
        protocol: PANERELAY_PROTOCOL_VERSION,
        error: 'Invalid relay session request',
      });
      return;
    }

    const connectExpiresAt =
      Date.now() + (this.options.sessionConnectTimeoutMs ?? DEFAULT_SESSION_CONNECT_TIMEOUT_MS);
    const session: ActiveRelaySession = {
      id: randomUUID(),
      token: randomBytes(32).toString('base64url'),
      actor: payload.actor,
      connectExpiresAt,
    };
    this.activeSession = session;
    this.lastHeartbeatStatusAt = 0;
    this.scheduleSessionExpiry(session);
    this.emitCurrentSessionState('allocated');

    const result: RelaySessionCreated = {
      protocol: PANERELAY_PROTOCOL_VERSION,
      sessionId: session.id,
      cdpUrl: `ws://127.0.0.1:${this.port}/cdp?session=${encodeURIComponent(session.id)}&token=${encodeURIComponent(session.token)}`,
      connectExpiresAt: new Date(connectExpiresAt).toISOString(),
    };
    this.sendJson(response, 201, result);
  }

  private readJsonBody(request: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= MAX_SESSION_REQUEST_BYTES) chunks.push(chunk);
      });
      request.on('end', () => {
        if (size > MAX_SESSION_REQUEST_BYTES) {
          reject(new RelayHttpError(413, 'Relay session request is too large'));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          resolve(null);
        }
      });
      request.on('error', reject);
    });
  }

  private isSessionCreateRequest(value: unknown): value is RelaySessionCreateRequest {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<RelaySessionCreateRequest>;
    const actor = candidate.actor;
    return (
      candidate.protocol === PANERELAY_PROTOCOL_VERSION &&
      actor?.kind === 'automation' &&
      typeof actor.name === 'string' &&
      actor.name.length > 0 &&
      actor.name.length <= 64 &&
      (actor.sessionLabel === undefined ||
        (typeof actor.sessionLabel === 'string' && actor.sessionLabel.length <= 128))
    );
  }

  private sendJson(
    response: ServerResponse,
    status: number,
    body: RelaySessionCreated | RelaySessionError,
  ): void {
    if (response.headersSent || response.destroyed) return;
    response.writeHead(status, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify(body));
  }

  private scheduleSessionExpiry(session: ActiveRelaySession): void {
    this.clearSessionExpiryTimer();
    this.sessionExpiryTimer = setTimeout(
      () => {
        if (this.activeSession?.id !== session.id || this.clients.size > 0) return;
        this.revokeActiveSession('Relay session connection window expired', 1008, false, 'expired');
      },
      Math.max(0, session.connectExpiresAt - Date.now()),
    );
    this.sessionExpiryTimer.unref();
  }

  private clearSessionExpiryTimer(): void {
    if (!this.sessionExpiryTimer) return;
    clearTimeout(this.sessionExpiryTimer);
    this.sessionExpiryTimer = null;
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer || this.clients.size === 0) return;
    const intervalMs = this.options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.heartbeatTimer = setInterval(() => this.checkHeartbeat(), intervalMs);
    this.heartbeatTimer.unref();
  }

  private clearHeartbeatTimer(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private checkHeartbeat(): void {
    const session = this.activeSession;
    if (!session || this.clients.size === 0) {
      this.clearHeartbeatTimer();
      return;
    }

    const now = Date.now();
    const timeoutMs = this.options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
    const responsive = [...this.clients.values()].some(
      state => now - state.lastSeenAt <= timeoutMs,
    );
    if (!responsive) {
      this.revokeActiveSession('Automation lease heartbeat expired', 1011, true, 'expired');
      return;
    }

    for (const client of this.clients.keys()) {
      if (client.readyState === WebSocket.OPEN) client.ping();
    }
  }

  private touchClient(client: WebSocket): void {
    const state = this.clients.get(client);
    if (!state) return;
    const now = Date.now();
    state.lastSeenAt = now;
    if (this.activeSession) this.activeSession.lastHeartbeatAt = now;
    const intervalMs = this.options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    if (now - this.lastHeartbeatStatusAt >= intervalMs) {
      this.lastHeartbeatStatusAt = now;
      this.emitCurrentSessionState();
    }
  }

  private async handleClientMessage(client: WebSocket, rawMessage: string): Promise<void> {
    if (!this.clients.has(client)) return;

    let command: unknown;
    try {
      command = JSON.parse(rawMessage);
    } catch {
      this.sendProtocolError(client, null, 'CDP command is not valid JSON');
      return;
    }
    if (!command || typeof command !== 'object') {
      this.sendProtocolError(client, null, 'CDP command must be an object');
      return;
    }

    const candidate = command as Record<string, unknown>;
    const id = candidate.id;
    const method = candidate.method;
    const sessionId = typeof candidate.sessionId === 'string' ? candidate.sessionId : undefined;
    const params =
      candidate.params && typeof candidate.params === 'object'
        ? (candidate.params as Record<string, unknown>)
        : {};
    if (typeof id !== 'number' || typeof method !== 'string') {
      this.sendProtocolError(client, typeof id === 'number' ? id : null, 'Invalid CDP command');
      return;
    }

    const targetId = sessionId
      ? (this.pageSessions.get(sessionId)?.targetId ?? this.childSessions.get(sessionId)?.targetId)
      : typeof params.targetId === 'string' && this.targets.has(params.targetId)
        ? params.targetId
        : undefined;
    this.beginClientActivity(client, id, method, targetId);

    if (sessionId) {
      await this.forwardSessionCommand(client, id, sessionId, method, params);
      return;
    }
    if (method === 'Browser.getVersion') {
      this.sendBrowserVersion(client, id);
      return;
    }
    if (method.startsWith('Browser.')) {
      this.sendCdpError(
        client,
        id,
        -32000,
        `${method} requires browser-process ownership and is not supported by PaneRelay`,
        undefined,
        'policy-denied',
      );
      return;
    }
    if (method.startsWith('Target.')) {
      try {
        await this.handleTargetCommand(client, id, method, params);
      } catch (error) {
        this.sendCdpError(
          client,
          id,
          -32000,
          error instanceof Error ? error.message : String(error),
          undefined,
          'browser-error',
        );
      }
      return;
    }

    this.sendCdpError(
      client,
      id,
      -32000,
      `${method} requires an attached PaneRelay target session`,
      undefined,
      'policy-denied',
    );
  }

  private async handleTargetCommand(
    client: WebSocket,
    id: number,
    method: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    const state = this.clients.get(client);
    if (!state) return;

    switch (method) {
      case 'Target.setDiscoverTargets':
        state.discoverTargets = params.discover === true;
        this.sendResult(client, id, {});
        return;
      case 'Target.getTargets': {
        const targets = await this.refreshTargets();
        this.sendResult(client, id, {
          targetInfos: targets.map(target => this.toCdpTargetInfo(target)),
        });
        return;
      }
      case 'Target.attachToTarget': {
        const targetId = this.requiredTargetId(params);
        const flatten = params.flatten;
        if (flatten !== true) {
          this.sendCdpError(client, id, -32602, 'PaneRelay requires flattened CDP sessions');
          return;
        }
        await this.ensureKnownTarget(targetId);
        const sessionId = randomUUID();
        this.pageSessions.set(sessionId, { id: sessionId, targetId, client });
        state.sessions.add(sessionId);
        this.sendResult(client, id, { sessionId });
        return;
      }
      case 'Target.detachFromTarget': {
        const sessionId = typeof params.sessionId === 'string' ? params.sessionId : undefined;
        if (!sessionId || !this.removePageSession(sessionId)) {
          this.sendCdpError(client, id, -32602, 'Unknown PaneRelay target session');
          return;
        }
        this.sendResult(client, id, {});
        return;
      }
      case 'Target.createTarget': {
        const url = typeof params.url === 'string' ? params.url : 'about:blank';
        const result = await this.requestTarget({ kind: 'create', url, active: true });
        if (!result.success || !result.target)
          throw new Error(result.error || 'Tab creation failed');
        this.targets.set(result.target.targetId, result.target);
        this.sendResult(client, id, { targetId: result.target.targetId });
        return;
      }
      case 'Target.closeTarget': {
        const targetId = this.requiredTargetId(params);
        await this.ensureKnownTarget(targetId);
        const result = await this.requestTarget({ kind: 'close', targetId });
        if (!result.success) throw new Error(result.error || 'Tab close failed');
        this.sendResult(client, id, { success: true });
        return;
      }
      case 'Target.activateTarget': {
        const targetId = this.requiredTargetId(params);
        await this.ensureKnownTarget(targetId);
        const result = await this.requestTarget({ kind: 'activate', targetId });
        if (!result.success) throw new Error(result.error || 'Tab activation failed');
        if (result.target) this.targets.set(targetId, result.target);
        this.sendResult(client, id, {});
        return;
      }
      case 'Target.getTargetInfo': {
        const targetId = this.requiredTargetId(params);
        const target = await this.ensureKnownTarget(targetId);
        this.sendResult(client, id, { targetInfo: this.toCdpTargetInfo(target) });
        return;
      }
      case 'Target.getBrowserContexts':
        this.sendResult(client, id, { browserContextIds: [] });
        return;
      case 'Target.setAutoAttach':
        if (params.waitForDebuggerOnStart === true) {
          this.sendCdpError(
            client,
            id,
            -32000,
            'PaneRelay cannot pause new top-level tabs before their first request',
          );
          return;
        }
        this.sendResult(client, id, {});
        return;
      default:
        this.sendCdpError(client, id, -32601, `${method} is not supported by PaneRelay`);
    }
  }

  private requiredTargetId(params: Record<string, unknown>): string {
    if (typeof params.targetId !== 'string' || params.targetId.length === 0) {
      throw new Error('Target command requires a targetId');
    }
    return params.targetId;
  }

  private async ensureKnownTarget(targetId: string): Promise<CdpTargetInfo> {
    const existing = this.targets.get(targetId);
    if (existing) return existing;
    await this.refreshTargets();
    const refreshed = this.targets.get(targetId);
    if (!refreshed) throw new Error('PaneRelay target is no longer available');
    return refreshed;
  }

  private async refreshTargets(): Promise<CdpTargetInfo[]> {
    const result = await this.requestTarget({ kind: 'list' });
    if (!result.success || !result.targets) {
      throw new Error(result.error || 'PaneRelay could not list authorized targets');
    }
    const nextIds = new Set(result.targets.map(target => target.targetId));
    for (const targetId of this.targets.keys()) {
      if (!nextIds.has(targetId)) this.removeTarget(targetId);
    }
    for (const target of result.targets) this.targets.set(target.targetId, target);
    return result.targets;
  }

  private requestTarget(operation: CdpTargetOperation): Promise<CdpTargetResultMessage> {
    const requestId = randomUUID();
    const timeoutMs = this.options.extensionRequestTimeoutMs ?? EXTENSION_REQUEST_TIMEOUT_MS;
    const result = new Promise<CdpTargetResultMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTargetRequests.delete(requestId);
        reject(new Error(`Timed out waiting for Extension target operation ${operation.kind}`));
      }, timeoutMs);
      this.pendingTargetRequests.set(requestId, { resolve, reject, timer });
    });
    this.options.sendToExtension({
      type: 'cdp.target.request',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId,
      operation,
    });
    return result;
  }

  private resolveTargetRequest(message: CdpTargetResultMessage): void {
    const pending = this.pendingTargetRequests.get(message.requestId);
    if (!pending) return;
    this.pendingTargetRequests.delete(message.requestId);
    clearTimeout(pending.timer);
    pending.resolve(message);
  }

  private async forwardSessionCommand(
    client: WebSocket,
    cdpId: number,
    sessionId: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    const pageSession = this.pageSessions.get(sessionId);
    const childSession = this.childSessions.get(sessionId);
    const targetId = pageSession?.targetId ?? childSession?.targetId;
    if (!targetId || (pageSession && pageSession.client !== client)) {
      this.sendCdpError(
        client,
        cdpId,
        -32000,
        'Unknown PaneRelay CDP session',
        sessionId,
        'policy-denied',
      );
      return;
    }

    const policyError = this.targetCommandPolicyError(targetId, method, params);
    if (policyError) {
      this.sendCdpError(client, cdpId, -32000, policyError, sessionId, 'policy-denied');
      return;
    }

    try {
      await this.ensureTargetAttached(targetId);
    } catch (error) {
      this.sendCdpError(
        client,
        cdpId,
        -32000,
        error instanceof Error ? error.message : String(error),
        sessionId,
        'browser-error',
      );
      return;
    }

    const requestId = randomUUID();
    const forwardedParams =
      pageSession &&
      method === 'Target.setAutoAttach' &&
      params.autoAttach === true &&
      params.waitForDebuggerOnStart === true
        ? { ...params, waitForDebuggerOnStart: false }
        : params;
    this.pendingCommands.set(requestId, { client, cdpId, sessionId });
    this.options.sendToExtension({
      type: 'cdp.command',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId,
      targetId,
      method,
      ...(Object.keys(forwardedParams).length > 0 ? { params: forwardedParams } : {}),
      ...(childSession ? { sessionId } : {}),
    });
  }

  private targetCommandPolicyError(
    targetId: string,
    method: string,
    params: Record<string, unknown>,
  ): string | null {
    if (method.startsWith('Browser.')) {
      return `${method} requires browser-process ownership and is not supported by PaneRelay`;
    }
    if (BROWSER_COOKIE_METHODS.has(method)) {
      return `${method} can access the entire daily Chrome profile and is not supported by PaneRelay`;
    }

    const target = this.targets.get(targetId);
    const targetUrl = this.httpUrl(target?.url);
    if (!targetUrl) return null;

    if (method === 'Network.getCookies') {
      const urls = Array.isArray(params.urls) ? params.urls : [];
      if (urls.some(url => typeof url !== 'string' || !this.hasSameOrigin(targetUrl, url))) {
        return 'Network.getCookies is limited to the selected PaneRelay target origin';
      }
    }

    if (method === 'Network.setCookie') {
      return this.cookieMutationPolicyError(targetUrl, params);
    }

    if (method === 'Network.setCookies') {
      if (!Array.isArray(params.cookies)) return 'Network.setCookies requires a cookie list';
      for (const cookie of params.cookies) {
        if (!cookie || typeof cookie !== 'object') {
          return 'Network.setCookies received an invalid cookie';
        }
        const error = this.cookieMutationPolicyError(targetUrl, cookie as Record<string, unknown>);
        if (error) return error;
      }
    }

    if (method === 'Network.deleteCookies') {
      return this.cookieMutationPolicyError(targetUrl, params);
    }

    if (
      method === 'Storage.clearDataForOrigin' &&
      (typeof params.origin !== 'string' || !this.hasSameOrigin(targetUrl, params.origin))
    ) {
      return 'Storage.clearDataForOrigin is limited to the selected PaneRelay target origin';
    }

    return null;
  }

  private cookieMutationPolicyError(
    targetUrl: URL,
    cookie: Record<string, unknown>,
  ): string | null {
    const cookieUrl = typeof cookie.url === 'string' ? cookie.url : undefined;
    const cookieDomain =
      typeof cookie.domain === 'string'
        ? cookie.domain.replace(/^\./, '').toLowerCase()
        : undefined;

    if (cookieUrl && !this.hasSameOrigin(targetUrl, cookieUrl)) {
      return 'Cookie mutation is limited to the selected PaneRelay target origin';
    }
    if (cookieDomain && cookieDomain !== targetUrl.hostname.toLowerCase()) {
      return 'Cookie mutation is limited to the selected PaneRelay target host';
    }
    if (!cookieUrl && !cookieDomain) {
      return 'Cookie mutation requires the selected PaneRelay target URL or host';
    }
    return null;
  }

  private httpUrl(value: string | undefined): URL | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
    } catch {
      return null;
    }
  }

  private hasSameOrigin(targetUrl: URL, candidate: string): boolean {
    const candidateUrl = this.httpUrl(candidate);
    return candidateUrl?.origin === targetUrl.origin;
  }

  private ensureTargetAttached(targetId: string): Promise<void> {
    if (this.attachedTargets.has(targetId)) return Promise.resolve();
    const existing = this.attachPromises.get(targetId);
    if (existing) return existing;

    const requestId = randomUUID();
    const timeoutMs = this.options.extensionRequestTimeoutMs ?? EXTENSION_REQUEST_TIMEOUT_MS;
    const promise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingAttaches.delete(requestId);
        reject(new Error('Timed out waiting for Extension debugger attachment'));
      }, timeoutMs);
      this.pendingAttaches.set(requestId, {
        resolve: message => {
          if (!message.success) {
            reject(new Error(message.error || 'Extension could not attach the target'));
            return;
          }
          if (message.target) this.targets.set(message.target.targetId, message.target);
          this.attachedTargets.add(targetId);
          this.emitCurrentSessionState('active');
          resolve();
        },
        reject,
        timer,
      });
    }).finally(() => {
      this.attachPromises.delete(targetId);
    });
    this.attachPromises.set(targetId, promise);
    this.options.sendToExtension({
      type: 'cdp.attach',
      protocol: PANERELAY_PROTOCOL_VERSION,
      requestId,
      targetId,
    });
    return promise;
  }

  private resolveAttach(message: CdpAttachedMessage): void {
    const pending = this.pendingAttaches.get(message.requestId);
    if (!pending) return;
    this.pendingAttaches.delete(message.requestId);
    clearTimeout(pending.timer);
    pending.resolve(message);
  }

  private forwardResult(message: CdpResultMessage): void {
    const pending = this.pendingCommands.get(message.requestId);
    if (!pending) return;
    this.pendingCommands.delete(message.requestId);
    this.finishClientActivity(
      pending.client,
      pending.cdpId,
      message.error ? 'failed' : 'completed',
      message.error ? 'browser-error' : undefined,
    );
    if (pending.client.readyState !== WebSocket.OPEN) return;
    pending.client.send(
      JSON.stringify({
        id: pending.cdpId,
        ...(message.error ? { error: message.error } : { result: message.result ?? {} }),
        ...(pending.sessionId ? { sessionId: pending.sessionId } : {}),
      }),
    );
  }

  private forwardEvent(message: CdpEventMessage): void {
    const childId = message.sessionId;
    if (message.method === 'Target.attachedToTarget') {
      const attachedSessionId = message.params?.sessionId;
      if (typeof attachedSessionId === 'string') {
        this.childSessions.set(attachedSessionId, { targetId: message.targetId });
      }
    } else if (message.method === 'Target.detachedFromTarget') {
      const detachedSessionId = message.params?.sessionId;
      if (typeof detachedSessionId === 'string') this.childSessions.delete(detachedSessionId);
    }

    if (childId) {
      const delivered = new Set<WebSocket>();
      for (const pageSession of this.pageSessions.values()) {
        if (
          pageSession.targetId === message.targetId &&
          pageSession.client.readyState === WebSocket.OPEN &&
          !delivered.has(pageSession.client)
        ) {
          pageSession.client.send(
            JSON.stringify({
              method: message.method,
              params: message.params ?? {},
              sessionId: childId,
            }),
          );
          delivered.add(pageSession.client);
        }
      }
      return;
    }

    for (const pageSession of this.pageSessions.values()) {
      if (
        pageSession.targetId === message.targetId &&
        pageSession.client.readyState === WebSocket.OPEN
      ) {
        pageSession.client.send(
          JSON.stringify({
            method: message.method,
            params: message.params ?? {},
            sessionId: pageSession.id,
          }),
        );
      }
    }
  }

  private handleTargetEvent(message: CdpTargetEventMessage): void {
    if (message.event === 'destroyed') {
      this.removeTarget(message.targetId);
      this.broadcastTargetEvent('Target.targetDestroyed', { targetId: message.targetId });
      return;
    }

    this.targets.set(message.target.targetId, message.target);
    this.broadcastTargetEvent(
      message.event === 'created' ? 'Target.targetCreated' : 'Target.targetInfoChanged',
      { targetInfo: this.toCdpTargetInfo(message.target) },
    );
  }

  private broadcastTargetEvent(method: string, params: Record<string, unknown>): void {
    const event = JSON.stringify({ method, params });
    for (const [client, state] of this.clients) {
      if (state.discoverTargets && client.readyState === WebSocket.OPEN) client.send(event);
    }
  }

  private toCdpTargetInfo(target: CdpTargetInfo): Record<string, unknown> {
    return {
      targetId: target.targetId,
      type: target.type,
      title: target.title,
      url: target.url,
      attached: [...this.pageSessions.values()].some(
        session => session.targetId === target.targetId,
      ),
    };
  }

  private removeTarget(targetId: string): void {
    this.targets.delete(targetId);
    const wasAttached = this.attachedTargets.delete(targetId);
    for (const [sessionId, session] of [...this.pageSessions]) {
      if (session.targetId === targetId) this.removePageSession(sessionId);
    }
    for (const [sessionId, session] of [...this.childSessions]) {
      if (session.targetId === targetId) this.childSessions.delete(sessionId);
    }
    if (wasAttached) this.emitCurrentSessionState();
  }

  private removePageSession(sessionId: string): boolean {
    const session = this.pageSessions.get(sessionId);
    if (!session) return false;
    this.pageSessions.delete(sessionId);
    this.clients.get(session.client)?.sessions.delete(sessionId);
    const stillReferenced = [...this.pageSessions.values()].some(
      candidate => candidate.targetId === session.targetId,
    );
    if (!stillReferenced && this.attachedTargets.delete(session.targetId)) {
      this.options.sendToExtension({
        type: 'cdp.detach',
        protocol: PANERELAY_PROTOCOL_VERSION,
        targetId: session.targetId,
        reason: 'No CDP sessions remain for the target',
      });
      this.emitCurrentSessionState();
    }
    return true;
  }

  private handleDetached(message: CdpDetachedMessage): void {
    if (message.scope === 'target' && message.targetId) {
      const wasAttached = this.attachedTargets.delete(message.targetId);
      for (const [sessionId, session] of [...this.childSessions]) {
        if (session.targetId === message.targetId) this.childSessions.delete(sessionId);
      }
      const target = this.targets.get(message.targetId);
      if (target) {
        this.targets.set(message.targetId, { ...target, attached: false });
        this.broadcastTargetEvent('Target.targetInfoChanged', {
          targetInfo: this.toCdpTargetInfo(target),
        });
      }
      if (wasAttached) this.emitCurrentSessionState();
      return;
    }
    this.revokeActiveSession(message.reason, 1011, false, 'released');
  }

  private handleClientClose(client: WebSocket): void {
    const state = this.clients.get(client);
    if (!state) return;
    this.failClientActivities(client, 'transport-error');
    for (const sessionId of [...state.sessions]) this.removePageSession(sessionId);
    this.clients.delete(client);
    for (const [requestId, pending] of this.pendingCommands) {
      if (pending.client === client) this.pendingCommands.delete(requestId);
    }
    if (this.clients.size === 0) {
      this.revokeActiveSession('Automation client disconnected', 1000, true);
    }
  }

  private revokeActiveSession(
    reason: string,
    closeCode: number,
    notifyExtension: boolean,
    terminalState: Extract<ControlSessionState, 'released' | 'expired' | 'failed'> = 'released',
  ): void {
    if (!this.activeSession) return;
    const hadTargets = this.attachedTargets.size > 0 || this.targets.size > 0;
    this.failOutstandingActivities('session-ended');
    this.emitCurrentSessionState(terminalState, 0);
    this.activeSession = null;
    this.clearSessionExpiryTimer();
    this.clearHeartbeatTimer();
    for (const client of [...this.clients.keys()]) {
      this.disconnectClient(client, closeCode, reason);
    }
    this.pendingCommands.clear();
    this.clientActivities.clear();
    this.pageSessions.clear();
    this.childSessions.clear();
    this.targets.clear();
    this.attachedTargets.clear();
    this.attachPromises.clear();
    this.rejectExtensionRequests(new Error(reason));

    if (notifyExtension && hadTargets) {
      this.options.sendToExtension({
        type: 'cdp.detach',
        protocol: PANERELAY_PROTOCOL_VERSION,
        reason,
      });
    }
  }

  private rejectExtensionRequests(error: Error): void {
    for (const pending of this.pendingAttaches.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingAttaches.clear();
    for (const pending of this.pendingTargetRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingTargetRequests.clear();
  }

  private sendBrowserVersion(client: WebSocket, id: number): void {
    if (client.readyState !== WebSocket.OPEN || !this.browser) return;
    this.sendResult(client, id, {
      protocolVersion: CDP_PROTOCOL_VERSION,
      product: `${this.browser.browserName} via PaneRelay`,
      revision: '',
      userAgent: '',
      jsVersion: '',
    });
  }

  private sendResult(client: WebSocket, id: number, result: unknown): void {
    this.finishClientActivity(client, id, 'completed');
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ id, result }));
  }

  private sendCdpError(
    client: WebSocket,
    id: number,
    code: number,
    message: string,
    sessionId?: string,
    failure: AutomationActivityFailure = 'policy-denied',
  ): void {
    this.finishClientActivity(
      client,
      id,
      failure === 'policy-denied' ? 'denied' : 'failed',
      failure,
    );
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(
      JSON.stringify({
        id,
        error: { code, message },
        ...(sessionId ? { sessionId } : {}),
      }),
    );
  }

  private sendProtocolError(client: WebSocket, id: number | null, message: string): void {
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify({ id, error: { code: -32600, message } }));
  }

  private disconnectClient(client: WebSocket, code: number, reason: string): void {
    this.clients.delete(client);
    if (client.readyState === WebSocket.CLOSED) return;
    client.close(code, reason);
    const terminationTimer = setTimeout(() => {
      if (client.readyState !== WebSocket.CLOSED) client.terminate();
    }, 250);
    terminationTimer.unref();
  }

  private beginClientActivity(
    client: WebSocket,
    cdpId: number,
    method: string,
    targetId?: string,
  ): void {
    const session = this.activeSession;
    if (!session) return;
    this.finishClientActivity(client, cdpId, 'failed', 'transport-error');

    const now = new Date().toISOString();
    const sequence = this.nextControlSequence();
    const activity: AutomationActivity = {
      id: randomUUID(),
      sessionId: session.id,
      actor: { ...session.actor },
      ...(targetId ? { targetId } : {}),
      ...classifyCdpMethod(method),
      status: 'started',
      sequence,
      startedAt: now,
      updatedAt: now,
    };
    const activities = this.clientActivities.get(client) ?? new Map<number, string>();
    activities.set(cdpId, activity.id);
    this.clientActivities.set(client, activities);
    this.storeAndEmitActivity(activity);
  }

  private finishClientActivity(
    client: WebSocket,
    cdpId: number,
    status: Exclude<AutomationActivityStatus, 'started'>,
    failure?: AutomationActivityFailure,
  ): void {
    const clientEntries = this.clientActivities.get(client);
    const activityId = clientEntries?.get(cdpId);
    if (!activityId) return;
    clientEntries?.delete(cdpId);
    if (clientEntries?.size === 0) this.clientActivities.delete(client);
    this.finishActivity(activityId, status, failure);
  }

  private finishActivity(
    activityId: string,
    status: Exclude<AutomationActivityStatus, 'started'>,
    failure?: AutomationActivityFailure,
  ): void {
    const index = this.activities.findIndex(activity => activity.id === activityId);
    if (index < 0) return;
    const current = this.activities[index];
    if (!current || current.status !== 'started') return;
    const activity: AutomationActivity = {
      ...current,
      status,
      ...(failure ? { failure } : {}),
      sequence: this.nextControlSequence(),
      updatedAt: new Date().toISOString(),
    };
    this.activities[index] = activity;
    this.emitActivity(activity);
  }

  private failClientActivities(client: WebSocket, failure: AutomationActivityFailure): void {
    const activities = this.clientActivities.get(client);
    if (!activities) return;
    for (const activityId of activities.values()) {
      this.finishActivity(activityId, 'failed', failure);
    }
    this.clientActivities.delete(client);
  }

  private failOutstandingActivities(failure: AutomationActivityFailure): void {
    for (const client of [...this.clientActivities.keys()]) {
      this.failClientActivities(client, failure);
    }
  }

  private storeAndEmitActivity(activity: AutomationActivity): void {
    this.activities.push(activity);
    if (this.activities.length > MAX_ACTIVITY_RECORDS) this.activities.shift();
    this.emitActivity(activity);
  }

  private emitActivity(activity: AutomationActivity): void {
    this.options.sendToExtension({
      type: 'control.activity.updated',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: this.activityEpoch,
      sequence: activity.sequence,
      activity,
    });
  }

  private emitCurrentSessionState(
    state?: ControlSessionState,
    controlledTargetCount = this.attachedTargets.size,
  ): void {
    const session = this.activeSession;
    if (!session) return;
    const terminal = state === 'released' || state === 'expired' || state === 'failed';
    const resolvedState =
      state ??
      (this.attachedTargets.size > 0 || this.pendingCommands.size > 0
        ? 'active'
        : session.connectedAt
          ? 'connected'
          : 'allocated');
    const heartbeatTimeoutMs = this.options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
    const message: ControlSessionChangedMessage = {
      type: 'control.session.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: this.activityEpoch,
      sequence: this.nextControlSequence(),
      session: {
        id: session.id,
        actor: { ...session.actor },
        state: resolvedState,
        controlledTargetCount,
        heartbeatFreshness: terminal
          ? resolvedState === 'expired'
            ? 'stale'
            : 'unknown'
          : session.lastHeartbeatAt
            ? 'fresh'
            : 'unknown',
        ...(!terminal && session.lastHeartbeatAt
          ? {
              lastHeartbeatAt: new Date(session.lastHeartbeatAt).toISOString(),
              leaseExpiresAt: new Date(session.lastHeartbeatAt + heartbeatTimeoutMs).toISOString(),
            }
          : {}),
        updatedAt: new Date().toISOString(),
      },
    };
    this.lastSessionMessage = message;
    this.options.sendToExtension(message);
  }

  private sendControlSnapshot(): void {
    if (this.lastSessionMessage) this.options.sendToExtension(this.lastSessionMessage);
    const firstRetainedSequence =
      this.activities.length > 0
        ? Math.min(...this.activities.map(activity => activity.sequence))
        : undefined;
    this.options.sendToExtension({
      type: 'control.activity.snapshot',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: this.activityEpoch,
      sequence: this.controlSequence,
      ...(firstRetainedSequence !== undefined ? { firstRetainedSequence } : {}),
      activities: [...this.activities],
    });
  }

  private nextControlSequence(): number {
    this.controlSequence += 1;
    return this.controlSequence;
  }
}
