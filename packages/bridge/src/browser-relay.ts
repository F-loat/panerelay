import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  PANERELAY_FETCH_DEFAULT_TIMEOUT_MS,
  PANERELAY_FETCH_MAX_HTTP_REQUEST_BYTES,
  PANERELAY_FETCH_MAX_SESSION_REQUEST_BYTES,
  PANERELAY_FETCH_MAX_SESSIONS,
  PANERELAY_FETCH_PERMISSION_PROTOCOL,
  PANERELAY_FETCH_PERMISSION_TIMEOUT_MS,
  PANERELAY_FETCH_SESSION_PROTOCOL,
  PANERELAY_FETCH_SESSION_TTL_MS,
  PANERELAY_PROTOCOL_VERSION,
  areBrowserFetchBindingPoliciesCompatible,
  doesBrowserFetchOriginMatch,
  isBrowserFetchRequest,
  isBrowserFetchPermissionRequest,
  isBrowserFetchSessionCreateRequest,
  isCdpBootstrapRequest,
  isCanonicalUuid,
  classifyCdpTargetAccess,
  type AutomationActivityFailure,
  type AutomationEngineId,
  type BrowserRegistration,
  type BrowserFetchRequest,
  type BrowserFetchBindingPolicy,
  type BrowserFetchPermissionResult,
  type BrowserFetchPermissionResultMessage,
  type BrowserFetchResponse,
  type BrowserFetchResultMessage,
  type BrowserFetchSessionCreated,
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
  type CdpBootstrapCreated,
  type CdpBootstrapError,
  type CdpBootstrapVersionMetadata,
  type ControlSessionState,
} from '@panerelay/protocol';
import WebSocket, { WebSocketServer } from 'ws';
import { targetCommandPolicyError } from './browser-relay-policy.js';
import { ControlActivityJournal } from './control-activity-journal.js';
import { KeyedCommandScheduler } from './keyed-command-scheduler.js';
import { CdpBootstrapStoreError, CdpBootstrapTicketStore } from './cdp-bootstrap-store.js';

interface PendingExtensionResult<T> {
  resolve: (result: T) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface PendingCommand {
  client: WebSocket;
  cdpId: number;
  targetId: string;
  method: string;
  sessionId?: string;
  chromeSessionId?: string;
  releaseTarget: () => void;
  timer: NodeJS.Timeout;
  onResult?: (message: CdpResultMessage) => void;
}

interface PendingFetchRequest {
  resolve: (response: BrowserFetchResponse) => void;
  reject: (error: Error) => void;
  sessionId: string;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  onAbort?: () => void;
}

interface PendingFetchPermissionRequest {
  resolve: (result: BrowserFetchPermissionResult) => void;
  reject: (error: Error) => void;
  browserId: string;
  generation: string;
  domain: string;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  onAbort?: () => void;
}

interface BrowserFetchSession {
  id: string;
  token: string;
  browserId: string;
  generation: string;
  allowedOrigins: string[];
  bindingPolicies: BrowserFetchBindingPolicy[];
  expiresAt: number;
  timer: NodeJS.Timeout;
  activeRequests: number;
}

interface RelayParticipant {
  id: string;
  token: string;
  actor: RelaySessionActor;
  engine: AutomationEngineId;
  connectExpiresAt: number;
  connectedAt?: number;
  lastHeartbeatAt?: number;
  expiryTimer?: NodeJS.Timeout;
  clients: Set<WebSocket>;
  childTargetIds: Map<string, string>;
  connectionPolicy: 'multiple' | 'single';
  bootstrapTicketId?: string;
  credentialConsumed?: boolean;
  initialTargetId?: string;
}

interface ActiveControlLease {
  id: string;
  participants: Map<string, RelayParticipant>;
  activeParticipantId: string;
  actor: RelaySessionActor;
}

interface PageSession {
  id: string;
  targetId: string;
  client: WebSocket;
  autoAttach?: {
    params: Record<string, unknown>;
    enabled: boolean;
  };
}

interface ClientState {
  participantId: string;
  discoverTargets: boolean;
  sessions: Set<string>;
  autoAttach?: {
    params: Record<string, unknown>;
    enabled: boolean;
  };
  lastSeenAt: number;
  initialization: Promise<void>;
}

interface ChildSession {
  id: string;
  targetId: string;
  childTargetId: string;
  chromeSessionId: string;
  client: WebSocket;
  parentSessionId?: string;
  rootPageSessionId?: string;
  autoAttachEnabled?: boolean;
}

interface PhysicalChildTarget {
  ownerTargetId: string;
  chromeSessionId: string;
  chromeTargetId: string;
  parentChromeSessionId?: string;
  type: string;
  title: string;
  url: string;
}

interface TargetControlClaim {
  engine: AutomationEngineId;
  sequence: number;
}

const MAX_LEASE_PARTICIPANTS = 8;
const MAX_PARTICIPANT_CONNECTIONS = 4;
const MAX_LEASE_CONNECTIONS = MAX_LEASE_PARTICIPANTS * MAX_PARTICIPANT_CONNECTIONS;
const CDP_PROTOCOL_VERSION = '1.3';
const DEFAULT_SESSION_CONNECT_TIMEOUT_MS = 30_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 35_000;
const EXTENSION_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_HTTP_REQUEST_TIMEOUT_MS = 5_000;
const MAX_SESSION_REQUEST_BYTES = 16 * 1024;
export const DEFAULT_FETCH_SESSION_MAX_REQUESTS = 8;
const MAX_CONFIGURED_FETCH_SESSION_REQUESTS = 64;
const TARGET_LIFECYCLE_QUEUE = 'panerelay:target-lifecycle';
const CHILD_AUTO_ATTACH_PARAMS = {
  autoAttach: true,
  waitForDebuggerOnStart: false,
  flatten: true,
} as const;
class RelayHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly bootstrapCode?: CdpBootstrapError['error']['code'],
  ) {
    super(message);
  }
}

class TargetHintUnavailableError extends Error {
  constructor() {
    super('The Panerelay conversation target is no longer available');
    this.name = 'TargetHintUnavailableError';
  }
}

export interface BrowserRelayOptions {
  expectedExtensionId?: string;
  hostVersion?: string;
  sendToExtension: (message: HostToExtensionMessage) => void;
  afterBrowserRegistration?: (browser: BrowserRegistration) => void | Promise<void>;
  onHostUpdateRetry?: () => void | Promise<void>;
  onBrowserRegistered: (browser: BrowserRegistration) => void | Promise<void>;
  onBrowserDisconnected: () => void | Promise<void>;
  extensionRequestTimeoutMs?: number;
  sessionConnectTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  bootstrapTicketTtlMs?: number;
  bootstrapConnectionWindowMs?: number;
  bootstrapMaxOutstandingTickets?: number;
  httpRequestTimeoutMs?: number;
  fetchSessionMaxRequests?: number;
}

const MAX_PENDING_FETCH_PERMISSION_REQUESTS = 4;

export class BrowserRelay {
  readonly port: number;
  readonly token = randomBytes(32).toString('base64url');
  readonly generation = randomUUID();

  private readonly clients = new Map<WebSocket, ClientState>();
  private readonly targets = new Map<string, CdpTargetInfo>();
  private readonly pageSessions = new Map<string, PageSession>();
  private readonly childSessions = new Map<string, ChildSession>();
  private readonly childTargets = new Map<string, PhysicalChildTarget>();
  private readonly playwrightMainFrameIds = new Map<string, string>();
  private readonly runtimeExecutionContexts = new Map<
    string,
    Map<number, Record<string, unknown>>
  >();
  private readonly attachedTargets = new Set<string>();
  private readonly autoAttachTargets = new Set<string>();
  private readonly autoAttachChildSessions = new Set<string>();
  private readonly childAutoAttachPromises = new Map<string, Promise<void>>();
  private readonly targetControlClaims = new Map<string, Map<string, TargetControlClaim>>();
  private controlClaimSequence = 0;
  private readonly focusEmulationTargets = new Set<string>();
  private readonly focusEmulationParticipants = new Map<string, Set<string>>();
  private readonly attachPromises = new Map<string, Promise<void>>();
  private readonly pendingAttaches = new Map<string, PendingExtensionResult<CdpAttachedMessage>>();
  private readonly pendingTargetRequests = new Map<
    string,
    PendingExtensionResult<CdpTargetResultMessage>
  >();
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private readonly pendingFetchRequests = new Map<string, PendingFetchRequest>();
  private readonly pendingFetchPermissionRequests = new Map<
    string,
    PendingFetchPermissionRequest
  >();
  private readonly fetchSessions = new Map<string, BrowserFetchSession>();
  private readonly pendingSetupCommands = new Map<
    string,
    PendingExtensionResult<CdpResultMessage>
  >();
  private readonly targetCommands = new KeyedCommandScheduler<string, WebSocket>({
    inactiveOwnerError: () =>
      new Error('Automation participant disconnected while waiting for the target'),
    isOwnerActive: client => this.clients.has(client),
  });
  private readonly activityJournal: ControlActivityJournal<WebSocket>;
  private readonly bootstrapTickets: CdpBootstrapTicketStore<RelayParticipant>;
  private readonly fetchSessionMaxRequests: number;
  private browser: BrowserRegistration | null = null;
  private activeLease: ActiveControlLease | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastHeartbeatStatusAt = 0;

  private constructor(
    private readonly server: WebSocketServer,
    private readonly httpServer: Server,
    private readonly options: BrowserRelayOptions,
    port: number,
  ) {
    this.port = port;
    const fetchSessionMaxRequests =
      options.fetchSessionMaxRequests ?? DEFAULT_FETCH_SESSION_MAX_REQUESTS;
    if (
      !Number.isSafeInteger(fetchSessionMaxRequests) ||
      fetchSessionMaxRequests < 1 ||
      fetchSessionMaxRequests > MAX_CONFIGURED_FETCH_SESSION_REQUESTS
    ) {
      throw new Error(
        `fetchSessionMaxRequests must be an integer between 1 and ${MAX_CONFIGURED_FETCH_SESSION_REQUESTS}`,
      );
    }
    this.fetchSessionMaxRequests = fetchSessionMaxRequests;
    this.bootstrapTickets = new CdpBootstrapTicketStore<RelayParticipant>({
      ...(options.bootstrapTicketTtlMs === undefined
        ? {}
        : { ticketTtlMs: options.bootstrapTicketTtlMs }),
      ...(options.bootstrapConnectionWindowMs === undefined
        ? {}
        : { connectionWindowMs: options.bootstrapConnectionWindowMs }),
      ...(options.bootstrapMaxOutstandingTickets === undefined
        ? {}
        : { maxOutstandingTickets: options.bootstrapMaxOutstandingTickets }),
      onParticipantInvalidated: (participant, reason) => {
        this.releaseParticipant(participant.id, reason, 1008, 'expired');
      },
    });
    this.activityJournal = new ControlActivityJournal({
      emit: message => this.options.sendToExtension(message),
    });
    this.server.on('connection', (client, request) => this.handleConnection(client, request));
    this.httpServer.on('request', (request, response) => {
      void this.handleHttpRequest(request, response).catch(error => {
        const status = error instanceof RelayHttpError ? error.status : 500;
        this.sendJson(response, status, {
          protocol: PANERELAY_PROTOCOL_VERSION,
          error:
            error instanceof RelayHttpError ? error.message : 'Panerelay Bridge request failed',
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
      throw new Error('Panerelay Bridge did not receive a TCP address');
    }
    return new BrowserRelay(server, httpServer, options, address.port);
  }

  async handleExtensionMessage(message: ExtensionToHostMessage): Promise<void> {
    switch (message.type) {
      case 'browser.register': {
        if (
          this.options.expectedExtensionId &&
          message.extensionId !== this.options.expectedExtensionId
        ) {
          throw new Error(
            `Extension ID ${message.extensionId} does not match the configured Panerelay Extension ID`,
          );
        }
        const browser: BrowserRegistration = {
          browserId: message.browserId,
          browserName: message.browserName,
          extensionId: message.extensionId,
          releaseVersion: message.releaseVersion,
          buildVersion: message.buildVersion,
          checkHostUpdate: message.checkHostUpdate,
          ...(message.browserFamily ? { browserFamily: message.browserFamily } : {}),
          ...(message.capabilities ? { capabilities: message.capabilities } : {}),
        };
        if (this.browser && this.browser.browserId !== browser.browserId) {
          this.clearFetchSessions('The registered browser changed');
          this.clearFetchPermissionRequests('The registered browser changed');
        }
        this.browser = browser;
        await this.options.onBrowserRegistered(this.browser);
        this.options.sendToExtension({
          type: 'browser.registered',
          protocol: PANERELAY_PROTOCOL_VERSION,
          browserId: message.browserId,
          hostVersion: this.options.hostVersion ?? '0.0.0',
        });
        this.activityJournal.emitSnapshot();
        void Promise.resolve()
          .then(() => this.options.afterBrowserRegistration?.(browser))
          .catch(() => undefined);
        return;
      }
      case 'host.update.retry':
        await this.options.onHostUpdateRetry?.();
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
        if (!this.resolveSetupCommand(message)) this.forwardResult(message);
        return;
      case 'cdp.event':
        this.forwardEvent(message);
        return;
      case 'cdp.detached':
        this.handleDetached(message);
        return;
      case 'fetch.result':
        this.resolveFetchRequest(message);
        return;
      case 'fetch.permission.result':
        this.resolveFetchPermissionRequest(message);
        return;
    }
  }

  async close(reason = 'Bridge shutting down'): Promise<void> {
    this.revokeActiveLease(reason, 1012, true, 'failed', true);
    this.clearFetchSessions(reason);
    this.clearFetchPermissionRequests(reason);
    this.bootstrapTickets.clear(reason);
    this.rejectExtensionRequests(new Error(reason));
    await new Promise<void>(resolve => this.server.close(() => resolve()));
    await new Promise<void>(resolve => this.httpServer.close(() => resolve()));
    this.browser = null;
    await this.options.onBrowserDisconnected();
  }

  private handleConnection(client: WebSocket, request: IncomingMessage): void {
    const participant = this.authorizedParticipant(request);
    if (!participant) {
      client.close(1008, 'Invalid Panerelay session token');
      return;
    }
    if (!this.browser) {
      client.close(1013, 'Panerelay extension is not registered');
      return;
    }
    if (this.clients.size >= MAX_LEASE_CONNECTIONS) {
      client.close(1013, 'The Panerelay lease has too many transport connections');
      return;
    }
    if (participant.clients.size >= MAX_PARTICIPANT_CONNECTIONS) {
      client.close(1013, 'The Panerelay participant has too many transport connections');
      return;
    }
    if (participant.connectionPolicy === 'single') {
      if (participant.credentialConsumed || !participant.bootstrapTicketId || !this.browser) {
        client.close(1008, 'Panerelay CDP connection credential was already consumed');
        return;
      }
      try {
        this.bootstrapTickets.consume(participant.bootstrapTicketId, {
          browserId: this.browser.browserId,
          generation: this.generation,
        });
      } catch {
        client.close(1008, 'Panerelay CDP connection credential is no longer valid');
        return;
      }
      participant.credentialConsumed = true;
      participant.token = '';
    }

    const now = Date.now();
    const initialization =
      participant.engine === 'playwright'
        ? this.refreshTargets()
            .then(() => undefined)
            .catch(() => undefined)
        : Promise.resolve();
    this.clients.set(client, {
      participantId: participant.id,
      discoverTargets: false,
      sessions: new Set(),
      lastSeenAt: now,
      initialization,
    });
    participant.clients.add(client);
    participant.connectedAt ??= now;
    participant.lastHeartbeatAt = now;
    this.clearParticipantExpiry(participant);
    if (this.activeLease) {
      this.activeLease.activeParticipantId = participant.id;
      this.activeLease.actor = participant.actor;
    }
    this.lastHeartbeatStatusAt = now;
    this.startHeartbeat();
    this.emitCurrentSessionState('connected');
    client.on('message', data => {
      this.touchClient(client, true);
      const state = this.clients.get(client);
      void (state?.initialization ?? Promise.resolve())
        .then(() => this.handleClientMessage(client, data.toString()))
        .catch(error => {
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

  private authorizedParticipant(request: IncomingMessage): RelayParticipant | null {
    try {
      const url = new URL(request.url || '/', 'ws://127.0.0.1');
      if (url.pathname !== '/cdp') return null;
      const participantId = url.searchParams.get('session');
      if (!participantId) return null;
      const participant = this.activeLease?.participants.get(participantId);
      if (
        !participant ||
        (participant.connectedAt === undefined && Date.now() > participant.connectExpiresAt) ||
        url.searchParams.get('token') !== participant.token
      ) {
        return null;
      }
      return participant;
    } catch {
      return null;
    }
  }

  private async handleHttpRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const versionMatch = /^\/cdp\/bootstrap\/([A-Za-z0-9_-]{43})\/json\/version\/?$/.exec(
      url.pathname,
    );
    if (request.method === 'GET' && versionMatch?.[1] && url.search === '') {
      await this.handleBootstrapVersion(versionMatch[1], response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/fetch' && url.search === '') {
      const session = this.authorizedFetchSession(request);
      if (!session) {
        this.sendJson(response, 401, {
          protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
          error: 'Invalid or expired Panerelay fetch session token',
        });
        return;
      }
      await this.handleFetchRequest(session, request, response);
      return;
    }
    if (!this.isAuthorizedBootstrapRequest(request)) {
      if (url.pathname.startsWith('/cdp/bootstrap')) {
        this.sendBootstrapError(response, 401, 'unauthorized', 'Invalid Panerelay Bridge token');
      } else {
        this.sendJson(response, 401, {
          protocol: PANERELAY_PROTOCOL_VERSION,
          error: 'Invalid Panerelay Bridge token',
        });
      }
      return;
    }

    if (request.method === 'POST' && url.pathname === '/cdp/bootstrap' && url.search === '') {
      await this.handleCreateBootstrap(request, response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/sessions') {
      await this.handleCreateSession(request, response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/fetch/sessions' && url.search === '') {
      await this.handleCreateFetchSession(request, response);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/fetch/permissions' && url.search === '') {
      await this.handleFetchPermissionRequest(request, response);
      return;
    }

    const fetchSessionMatch = /^\/fetch\/sessions\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'DELETE' && fetchSessionMatch?.[1] && url.search === '') {
      this.releaseFetchSession(
        decodeURIComponent(fetchSessionMatch[1]),
        'Panerelay fetch caller released the session',
      );
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    const sessionMatch = /^\/sessions\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'DELETE' && sessionMatch?.[1]) {
      this.releaseParticipant(
        decodeURIComponent(sessionMatch[1]),
        'Automation provider released the participant',
        1000,
        'released',
      );
      response.writeHead(204);
      response.end();
      return;
    }

    this.sendJson(response, 404, {
      protocol: PANERELAY_PROTOCOL_VERSION,
      error: 'Unknown Panerelay Bridge endpoint',
    });
  }

  private async handleBootstrapVersion(ticketId: string, response: ServerResponse): Promise<void> {
    if (!this.browser) {
      this.sendBootstrapError(
        response,
        503,
        'browser-unavailable',
        'Panerelay extension is not registered',
      );
      return;
    }
    if (this.browser.capabilities?.cdpRelay === false) {
      this.sendBootstrapError(
        response,
        409,
        'unsupported',
        'The registered browser cannot provide a Panerelay CDP relay',
      );
      return;
    }
    const browser = { browserId: this.browser.browserId, generation: this.generation };
    try {
      const initialTargetId = this.bootstrapTickets.initialTargetId(ticketId, browser);
      if (initialTargetId) await this.requireAvailableInitialTarget(initialTargetId);
      const activation = this.bootstrapTickets.activate(ticketId, browser, context => {
        const participant = this.allocateParticipant(
          context.actor,
          context.engine,
          context.connectExpiresAt,
          'single',
          context.initialTargetId,
        );
        participant.bootstrapTicketId = context.ticketId;
        return {
          participant,
          cdpUrl: this.participantCdpUrl(participant),
        };
      });
      const result: CdpBootstrapVersionMetadata = {
        Browser: `Panerelay/${this.browser.releaseVersion}`,
        'Protocol-Version': CDP_PROTOCOL_VERSION,
        'User-Agent': this.browser.browserName,
        'V8-Version': '0.0',
        'WebKit-Version': '537.36 (@panerelay)',
        webSocketDebuggerUrl: activation.cdpUrl,
      };
      this.sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof TargetHintUnavailableError) {
        this.sendBootstrapError(response, 409, 'target-unavailable', error.message);
        return;
      }
      if (error instanceof RelayHttpError && error.status === 429) {
        this.sendBootstrapError(
          response,
          429,
          error.bootstrapCode ?? 'participant-limit',
          error.message,
        );
        return;
      }
      if (error instanceof CdpBootstrapStoreError) {
        const statuses: Partial<Record<CdpBootstrapError['error']['code'], number>> = {
          'ticket-invalid': 404,
          'ticket-expired': 410,
          'ticket-consumed': 410,
          'generation-changed': 409,
          'lane-busy': 409,
        };
        this.sendBootstrapError(response, statuses[error.code] ?? 400, error.code, error.message);
        return;
      }
      throw error;
    }
  }

  private async handleCreateBootstrap(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (!this.browser) {
      this.sendBootstrapError(
        response,
        503,
        'browser-unavailable',
        'Panerelay extension is not registered',
      );
      return;
    }
    if (this.browser.capabilities?.cdpRelay === false) {
      this.sendBootstrapError(
        response,
        409,
        'unsupported',
        'The registered browser cannot provide a Panerelay CDP relay',
      );
      return;
    }
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      this.sendBootstrapError(response, 415, 'invalid-request', 'CDP bootstrap requires JSON');
      return;
    }
    let payload: unknown;
    try {
      payload = await this.readJsonBody(request);
    } catch (error) {
      if (error instanceof RelayHttpError && (error.status === 413 || error.status === 408)) {
        this.sendBootstrapError(
          response,
          error.status,
          'invalid-request',
          error.status === 413
            ? 'CDP bootstrap request is too large'
            : 'CDP bootstrap request timed out',
        );
        return;
      }
      throw error;
    }
    if (!isCdpBootstrapRequest(payload)) {
      this.sendBootstrapError(response, 400, 'invalid-request', 'Invalid CDP bootstrap request');
      return;
    }
    if (
      payload.browser.browserId !== this.browser.browserId ||
      payload.browser.generation !== this.generation
    ) {
      this.sendBootstrapError(
        response,
        409,
        'generation-changed',
        'The selected browser connection changed; resolve it again',
      );
      return;
    }
    try {
      const ticket = this.bootstrapTickets.issue(payload);
      const result: CdpBootstrapCreated = {
        protocol: PANERELAY_PROTOCOL_VERSION,
        cdpUrl: `http://127.0.0.1:${this.port}/cdp/bootstrap/${encodeURIComponent(ticket.ticketId)}`,
        expiresAt: new Date(ticket.expiresAt).toISOString(),
      };
      this.sendJson(response, 201, result);
    } catch (error) {
      if (error instanceof CdpBootstrapStoreError && error.code === 'ticket-limit') {
        this.sendBootstrapError(response, 429, error.code, error.message);
        return;
      }
      throw error;
    }
  }

  private isAuthorizedBootstrapRequest(request: IncomingMessage): boolean {
    return request.headers.authorization === `Bearer ${this.token}`;
  }

  private authorizedFetchSession(request: IncomingMessage): BrowserFetchSession | null {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return null;
    const token = authorization.slice('Bearer '.length);
    const now = Date.now();
    for (const session of this.fetchSessions.values()) {
      if (session.token !== token) continue;
      if (
        now >= session.expiresAt ||
        !this.browser ||
        session.browserId !== this.browser.browserId ||
        session.generation !== this.generation
      ) {
        this.releaseFetchSession(session.id, 'Panerelay fetch session expired or changed');
        return null;
      }
      return session;
    }
    return null;
  }

  private async handleCreateFetchSession(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (!this.browser) {
      this.sendJson(response, 503, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: 'Panerelay extension is not registered',
      });
      return;
    }
    if (this.browser.capabilities?.browserFetch !== true) {
      this.sendJson(response, 409, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: `${this.browser.browserName} does not support Panerelay browser fetch`,
      });
      return;
    }
    if (this.fetchSessions.size >= PANERELAY_FETCH_MAX_SESSIONS) {
      this.sendJson(response, 429, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: 'The selected browser has too many active fetch sessions',
      });
      return;
    }
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      this.sendJson(response, 415, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: 'Panerelay fetch session creation requires JSON',
      });
      return;
    }
    let payload: unknown;
    try {
      payload = await this.readJsonBody(request, PANERELAY_FETCH_MAX_SESSION_REQUEST_BYTES);
    } catch (error) {
      if (error instanceof RelayHttpError) {
        this.sendJson(response, error.status, {
          protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
          error: error.message,
        });
        return;
      }
      throw error;
    }
    if (!isBrowserFetchSessionCreateRequest(payload)) {
      this.sendJson(response, 400, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: 'Invalid Panerelay fetch session request',
      });
      return;
    }
    if (
      payload.browser.browserId !== this.browser.browserId ||
      payload.browser.generation !== this.generation
    ) {
      this.sendJson(response, 409, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: 'The selected browser connection changed; resolve it again',
      });
      return;
    }

    const id = randomUUID();
    const expiresAt = Date.now() + PANERELAY_FETCH_SESSION_TTL_MS;
    const session: BrowserFetchSession = {
      id,
      token: randomBytes(32).toString('base64url'),
      browserId: this.browser.browserId,
      generation: this.generation,
      allowedOrigins: [...payload.allowedOrigins],
      bindingPolicies: [...(payload.bindingPolicies ?? [])],
      expiresAt,
      activeRequests: 0,
      timer: setTimeout(
        () => this.releaseFetchSession(id, 'Panerelay fetch session expired'),
        PANERELAY_FETCH_SESSION_TTL_MS,
      ),
    };
    session.timer.unref();
    this.fetchSessions.set(id, session);
    const result: BrowserFetchSessionCreated = {
      protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
      sessionId: id,
      endpoint: `http://127.0.0.1:${this.port}/fetch`,
      token: session.token,
      expiresAt: new Date(expiresAt).toISOString(),
    };
    this.sendJson(response, 201, result);
  }

  private async handleFetchRequest(
    session: BrowserFetchSession,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (session.activeRequests >= this.fetchSessionMaxRequests) {
      this.sendJson(response, 429, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: 'Panerelay fetch session has too many active requests',
      });
      return;
    }
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      this.sendJson(response, 415, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: 'Panerelay browser fetch requires JSON',
      });
      return;
    }
    let payload: unknown;
    try {
      payload = await this.readJsonBody(request, PANERELAY_FETCH_MAX_HTTP_REQUEST_BYTES);
    } catch (error) {
      if (error instanceof RelayHttpError) {
        this.sendJson(response, error.status, {
          protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
          error: error.message,
        });
        return;
      }
      throw error;
    }
    if (!isBrowserFetchRequest(payload)) {
      this.sendJson(response, 400, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: 'Invalid Panerelay browser fetch request',
      });
      return;
    }
    if (!session.allowedOrigins.some(origin => doesBrowserFetchOriginMatch(origin, payload.url))) {
      this.sendJson(response, 403, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: 'Browser fetch target is outside this session origin scope',
      });
      return;
    }
    const policies = (payload.bindings ?? []).map(id =>
      session.bindingPolicies.find(policy => policy.id === id),
    );
    if (
      policies.some(policy => policy === undefined) ||
      !areBrowserFetchBindingPoliciesCompatible(payload, policies as BrowserFetchBindingPolicy[])
    ) {
      this.sendJson(response, 403, {
        protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
        error: 'Browser fetch binding is outside this session authority',
      });
      return;
    }
    session.activeRequests += 1;
    const controller = new AbortController();
    const abort = () => controller.abort();
    response.once('close', abort);
    try {
      const result = await this.requestBrowserFetch(
        session,
        payload,
        policies as BrowserFetchBindingPolicy[],
        controller.signal,
      );
      if (!response.destroyed) this.sendJson(response, 200, result);
    } catch (error) {
      if (!response.destroyed) {
        this.sendJson(response, 502, {
          protocol: PANERELAY_FETCH_SESSION_PROTOCOL,
          error: error instanceof Error ? error.message : 'Panerelay browser fetch failed',
        });
      }
    } finally {
      response.off('close', abort);
      session.activeRequests = Math.max(0, session.activeRequests - 1);
    }
  }

  private async handleFetchPermissionRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (!this.browser) {
      this.sendJson(response, 503, {
        protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
        error: 'Panerelay extension is not registered',
      });
      return;
    }
    if (this.browser.capabilities?.browserFetch !== true) {
      this.sendJson(response, 409, {
        protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
        error: `${this.browser.browserName} does not support Panerelay browser fetch`,
      });
      return;
    }
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      this.sendJson(response, 415, {
        protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
        error: 'Panerelay fetch authorization requires JSON',
      });
      return;
    }
    let payload: unknown;
    try {
      payload = await this.readJsonBody(request);
    } catch (error) {
      if (error instanceof RelayHttpError) {
        this.sendJson(response, error.status, {
          protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
          error: error.message,
        });
        return;
      }
      throw error;
    }
    if (!isBrowserFetchPermissionRequest(payload)) {
      this.sendJson(response, 400, {
        protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
        error: 'Invalid Panerelay fetch authorization request',
      });
      return;
    }
    if (
      payload.browser.browserId !== this.browser.browserId ||
      payload.browser.generation !== this.generation
    ) {
      this.sendJson(response, 409, {
        protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
        error: 'The selected browser connection changed; resolve it again',
      });
      return;
    }
    if (this.pendingFetchPermissionRequests.size >= MAX_PENDING_FETCH_PERMISSION_REQUESTS) {
      this.sendJson(response, 429, {
        protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
        error: 'Too many pending Panerelay fetch authorization requests',
      });
      return;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    response.once('close', abort);
    try {
      const result = await this.requestBrowserFetchPermission(payload.domain, controller.signal);
      if (!response.destroyed) this.sendJson(response, 200, result);
    } catch (error) {
      if (!response.destroyed) {
        this.sendJson(response, 502, {
          protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
          error:
            error instanceof Error ? error.message : 'Panerelay browser fetch authorization failed',
        });
      }
    } finally {
      response.off('close', abort);
    }
  }

  private requestBrowserFetch(
    session: BrowserFetchSession,
    request: BrowserFetchRequest,
    bindingPolicies: BrowserFetchBindingPolicy[],
    signal?: AbortSignal,
  ): Promise<BrowserFetchResponse> {
    if (
      !this.browser ||
      session.browserId !== this.browser.browserId ||
      session.generation !== this.generation
    ) {
      return Promise.reject(new Error('The selected browser connection changed; resolve it again'));
    }
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        const pending = this.pendingFetchRequests.get(requestId);
        if (!pending) return;
        this.pendingFetchRequests.delete(requestId);
        clearTimeout(pending.timer);
        pending.signal?.removeEventListener('abort', pending.onAbort!);
        this.cancelExtensionFetch(requestId, session);
        reject(new Error('Panerelay browser fetch was cancelled'));
      };
      const timeoutMs = (request.timeoutMs ?? PANERELAY_FETCH_DEFAULT_TIMEOUT_MS) + 5_000;
      const timer = setTimeout(() => {
        const pending = this.pendingFetchRequests.get(requestId);
        if (!pending) return;
        this.pendingFetchRequests.delete(requestId);
        pending.signal?.removeEventListener('abort', pending.onAbort!);
        this.cancelExtensionFetch(requestId, session);
        reject(new Error('Panerelay browser fetch timed out'));
      }, timeoutMs);
      timer.unref();
      this.pendingFetchRequests.set(requestId, {
        resolve,
        reject,
        sessionId: session.id,
        timer,
        ...(signal ? { signal, onAbort } : {}),
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) {
        onAbort();
        return;
      }
      try {
        this.options.sendToExtension({
          type: 'fetch.request',
          protocol: PANERELAY_PROTOCOL_VERSION,
          requestId,
          browserId: session.browserId,
          generation: session.generation,
          allowedOrigins: session.allowedOrigins,
          bindingPolicies,
          request,
        });
      } catch (error) {
        clearTimeout(timer);
        this.pendingFetchRequests.delete(requestId);
        signal?.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private resolveFetchRequest(message: BrowserFetchResultMessage): void {
    const pending = this.pendingFetchRequests.get(message.requestId);
    if (!pending) return;
    this.pendingFetchRequests.delete(message.requestId);
    clearTimeout(pending.timer);
    if (pending.signal && pending.onAbort) {
      pending.signal.removeEventListener('abort', pending.onAbort);
    }
    const session = this.fetchSessions.get(pending.sessionId);
    if (
      !session ||
      !this.browser ||
      session.browserId !== this.browser.browserId ||
      session.generation !== this.generation
    ) {
      pending.reject(new Error('The selected browser connection changed; resolve it again'));
      return;
    }
    if (message.success && message.response) {
      pending.resolve(message.response);
    } else {
      pending.reject(new Error(message.error ?? 'Panerelay browser fetch failed'));
    }
  }

  private requestBrowserFetchPermission(
    domain: string,
    signal?: AbortSignal,
  ): Promise<BrowserFetchPermissionResult> {
    if (!this.browser) {
      return Promise.reject(new Error('Panerelay extension is not registered'));
    }
    const requestId = randomUUID();
    const browserId = this.browser.browserId;
    const generation = this.generation;
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        const pending = this.pendingFetchPermissionRequests.get(requestId);
        if (!pending) return;
        this.pendingFetchPermissionRequests.delete(requestId);
        clearTimeout(pending.timer);
        pending.signal?.removeEventListener('abort', pending.onAbort!);
        this.cancelExtensionFetchPermission(requestId, pending);
        reject(new Error('Panerelay browser fetch authorization was cancelled'));
      };
      const timer = setTimeout(() => {
        const pending = this.pendingFetchPermissionRequests.get(requestId);
        if (!pending) return;
        this.pendingFetchPermissionRequests.delete(requestId);
        pending.signal?.removeEventListener('abort', pending.onAbort!);
        this.cancelExtensionFetchPermission(requestId, pending);
        reject(new Error('Panerelay browser fetch authorization timed out'));
      }, PANERELAY_FETCH_PERMISSION_TIMEOUT_MS + 5_000);
      timer.unref();
      this.pendingFetchPermissionRequests.set(requestId, {
        resolve,
        reject,
        browserId,
        generation,
        domain,
        timer,
        ...(signal ? { signal, onAbort } : {}),
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) {
        onAbort();
        return;
      }
      try {
        this.options.sendToExtension({
          type: 'fetch.permission.request',
          protocol: PANERELAY_PROTOCOL_VERSION,
          requestId,
          browserId,
          generation,
          domain,
        });
      } catch (error) {
        clearTimeout(timer);
        this.pendingFetchPermissionRequests.delete(requestId);
        signal?.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private resolveFetchPermissionRequest(message: BrowserFetchPermissionResultMessage): void {
    const pending = this.pendingFetchPermissionRequests.get(message.requestId);
    if (!pending) return;
    this.pendingFetchPermissionRequests.delete(message.requestId);
    clearTimeout(pending.timer);
    if (pending.signal && pending.onAbort) {
      pending.signal.removeEventListener('abort', pending.onAbort);
    }
    if (
      !this.browser ||
      pending.browserId !== this.browser.browserId ||
      pending.generation !== this.generation ||
      pending.domain !== message.domain
    ) {
      pending.reject(new Error('The selected browser connection changed; resolve it again'));
      return;
    }
    if (message.error) {
      pending.reject(new Error(message.error));
      return;
    }
    pending.resolve({
      protocol: PANERELAY_FETCH_PERMISSION_PROTOCOL,
      granted: message.granted,
      domain: message.domain,
      ...(message.scope ? { scope: message.scope } : {}),
    });
  }

  private releaseFetchSession(sessionId: string, reason: string): void {
    const session = this.fetchSessions.get(sessionId);
    if (!session) return;
    this.fetchSessions.delete(sessionId);
    clearTimeout(session.timer);
    for (const [requestId, pending] of this.pendingFetchRequests) {
      if (pending.sessionId !== sessionId) continue;
      this.pendingFetchRequests.delete(requestId);
      clearTimeout(pending.timer);
      if (pending.signal && pending.onAbort) {
        pending.signal.removeEventListener('abort', pending.onAbort);
      }
      this.cancelExtensionFetch(requestId, session);
      pending.reject(new Error(reason));
    }
  }

  private cancelExtensionFetch(requestId: string, session: BrowserFetchSession): void {
    if (
      !this.browser ||
      session.browserId !== this.browser.browserId ||
      session.generation !== this.generation
    ) {
      return;
    }
    try {
      this.options.sendToExtension({
        type: 'fetch.cancel',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        browserId: session.browserId,
        generation: session.generation,
      });
    } catch {
      // The pending caller is still rejected locally when the Extension transport is gone.
    }
  }

  private cancelExtensionFetchPermission(
    requestId: string,
    pending: PendingFetchPermissionRequest,
  ): void {
    if (
      !this.browser ||
      pending.browserId !== this.browser.browserId ||
      pending.generation !== this.generation
    ) {
      return;
    }
    try {
      this.options.sendToExtension({
        type: 'fetch.permission.cancel',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        browserId: pending.browserId,
        generation: pending.generation,
      });
    } catch {
      // The pending caller is still rejected locally when the Extension transport is gone.
    }
  }

  private clearFetchSessions(reason: string): void {
    for (const sessionId of [...this.fetchSessions.keys()]) {
      this.releaseFetchSession(sessionId, reason);
    }
  }

  private clearFetchPermissionRequests(reason: string): void {
    for (const [requestId, pending] of this.pendingFetchPermissionRequests) {
      this.pendingFetchPermissionRequests.delete(requestId);
      clearTimeout(pending.timer);
      if (pending.signal && pending.onAbort) {
        pending.signal.removeEventListener('abort', pending.onAbort);
      }
      this.cancelExtensionFetchPermission(requestId, pending);
      pending.reject(new Error(reason));
    }
  }

  private async handleCreateSession(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (!this.browser) {
      this.sendJson(response, 503, {
        protocol: PANERELAY_PROTOCOL_VERSION,
        error: 'Panerelay extension is not registered',
      });
      return;
    }
    if (this.browser.capabilities?.cdpRelay === false) {
      this.sendJson(response, 409, {
        protocol: PANERELAY_PROTOCOL_VERSION,
        error: `${this.browser.browserName} does not support Panerelay browser automation because its Extension cannot provide a CDP relay`,
      });
      return;
    }
    if ((this.activeLease?.participants.size ?? 0) >= MAX_LEASE_PARTICIPANTS) {
      this.sendJson(response, 429, {
        protocol: PANERELAY_PROTOCOL_VERSION,
        error: 'The authorized browser has too many active agent-browser participants',
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

    if (payload.initialTargetId) {
      try {
        await this.requireAvailableInitialTarget(payload.initialTargetId);
      } catch (error) {
        this.sendJson(response, 409, {
          protocol: PANERELAY_PROTOCOL_VERSION,
          error:
            error instanceof TargetHintUnavailableError
              ? error.message
              : 'The Panerelay conversation target is unavailable',
        });
        return;
      }
    }

    const connectExpiresAt =
      Date.now() + (this.options.sessionConnectTimeoutMs ?? DEFAULT_SESSION_CONNECT_TIMEOUT_MS);
    const participant = this.allocateParticipant(
      payload.actor,
      'agent-browser',
      connectExpiresAt,
      'multiple',
      payload.initialTargetId,
    );

    const result: RelaySessionCreated = {
      protocol: PANERELAY_PROTOCOL_VERSION,
      sessionId: participant.id,
      cdpUrl: this.participantCdpUrl(participant),
      connectExpiresAt: new Date(connectExpiresAt).toISOString(),
    };
    this.sendJson(response, 201, result);
  }

  private allocateParticipant(
    actor: RelaySessionActor,
    engine: AutomationEngineId,
    connectExpiresAt: number,
    connectionPolicy: RelayParticipant['connectionPolicy'],
    initialTargetId?: string,
  ): RelayParticipant {
    if ((this.activeLease?.participants.size ?? 0) >= MAX_LEASE_PARTICIPANTS) {
      throw new RelayHttpError(
        429,
        'The authorized browser has too many automation participants',
        'participant-limit',
      );
    }
    const participant: RelayParticipant = {
      id: randomUUID(),
      token: randomBytes(32).toString('base64url'),
      actor,
      engine,
      connectExpiresAt,
      clients: new Set(),
      childTargetIds: new Map(),
      connectionPolicy,
      ...(initialTargetId ? { initialTargetId } : {}),
    };
    if (!this.activeLease) {
      this.activeLease = {
        id: randomUUID(),
        participants: new Map(),
        activeParticipantId: participant.id,
        actor: participant.actor,
      };
    }
    this.activeLease.participants.set(participant.id, participant);
    this.activeLease.activeParticipantId = participant.id;
    this.activeLease.actor = participant.actor;
    this.lastHeartbeatStatusAt = 0;
    this.scheduleParticipantExpiry(participant);
    this.emitCurrentSessionState(
      this.clients.size > 0 || this.attachedTargets.size > 0 ? undefined : 'allocated',
    );
    return participant;
  }

  private participantCdpUrl(participant: RelayParticipant): string {
    return `ws://127.0.0.1:${this.port}/cdp?session=${encodeURIComponent(participant.id)}&token=${encodeURIComponent(participant.token)}`;
  }

  private readJsonBody(
    request: IncomingMessage,
    maxBytes = MAX_SESSION_REQUEST_BYTES,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let settled = false;
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        action();
      };
      const timer = setTimeout(() => {
        request.resume();
        finish(() => reject(new RelayHttpError(408, 'Relay request timed out')));
      }, this.options.httpRequestTimeoutMs ?? DEFAULT_HTTP_REQUEST_TIMEOUT_MS);
      timer.unref();
      request.on('data', (chunk: Buffer) => {
        if (settled) return;
        size += chunk.length;
        if (size <= maxBytes) chunks.push(chunk);
      });
      request.on('end', () => {
        if (settled) return;
        if (size > maxBytes) {
          finish(() => reject(new RelayHttpError(413, 'Relay request is too large')));
          return;
        }
        try {
          const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
          finish(() => resolve(value));
        } catch {
          finish(() => resolve(null));
        }
      });
      request.on('error', error => finish(() => reject(error)));
    });
  }

  private isSessionCreateRequest(value: unknown): value is RelaySessionCreateRequest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as Partial<RelaySessionCreateRequest>;
    const actor = candidate.actor;
    const keys = Object.keys(value).sort();
    const expectedKeys = (
      candidate.initialTargetId === undefined
        ? ['actor', 'protocol']
        : ['actor', 'initialTargetId', 'protocol']
    ).sort();
    if (
      keys.length !== expectedKeys.length ||
      !keys.every((key, index) => key === expectedKeys[index]) ||
      !actor ||
      typeof actor !== 'object' ||
      Array.isArray(actor)
    ) {
      return false;
    }
    const actorKeys = Object.keys(actor).sort();
    const expectedActorKeys = (
      actor.sessionLabel === undefined ? ['kind', 'name'] : ['kind', 'name', 'sessionLabel']
    ).sort();
    return (
      actorKeys.length === expectedActorKeys.length &&
      actorKeys.every((key, index) => key === expectedActorKeys[index]) &&
      candidate.protocol === PANERELAY_PROTOCOL_VERSION &&
      actor?.kind === 'automation' &&
      typeof actor.name === 'string' &&
      actor.name.length > 0 &&
      actor.name.length <= 64 &&
      (actor.sessionLabel === undefined ||
        (typeof actor.sessionLabel === 'string' && actor.sessionLabel.length <= 128)) &&
      (candidate.initialTargetId === undefined || isCanonicalUuid(candidate.initialTargetId))
    );
  }

  private sendJson(response: ServerResponse, status: number, body: unknown): void {
    if (response.headersSent || response.destroyed) return;
    response.writeHead(status, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify(body));
  }

  private sendBootstrapError(
    response: ServerResponse,
    status: number,
    code: CdpBootstrapError['error']['code'],
    message: string,
  ): void {
    this.sendJson(response, status, {
      protocol: PANERELAY_PROTOCOL_VERSION,
      error: { code, message },
    });
  }

  private scheduleParticipantExpiry(participant: RelayParticipant): void {
    this.clearParticipantExpiry(participant);
    participant.expiryTimer = setTimeout(
      () => {
        const current = this.activeLease?.participants.get(participant.id);
        if (current !== participant || participant.clients.size > 0) return;
        this.releaseParticipant(
          participant.id,
          'Relay participant connection window expired',
          1008,
          'expired',
        );
      },
      Math.max(0, participant.connectExpiresAt - Date.now()),
    );
    participant.expiryTimer.unref();
  }

  private clearParticipantExpiry(participant: RelayParticipant): void {
    if (!participant.expiryTimer) return;
    clearTimeout(participant.expiryTimer);
    participant.expiryTimer = undefined;
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
    const lease = this.activeLease;
    if (!lease || this.clients.size === 0) {
      this.clearHeartbeatTimer();
      return;
    }

    const now = Date.now();
    const timeoutMs = this.options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
    for (const participant of [...lease.participants.values()]) {
      if (
        participant.clients.size > 0 &&
        ![...participant.clients].some(client => {
          const state = this.clients.get(client);
          return state && now - state.lastSeenAt <= timeoutMs;
        })
      ) {
        this.releaseParticipant(
          participant.id,
          lease.participants.size === 1
            ? 'Automation lease heartbeat expired'
            : 'Automation participant heartbeat expired',
          1011,
          'expired',
        );
      }
    }

    for (const client of this.clients.keys()) {
      if (client.readyState === WebSocket.OPEN) client.ping();
    }
  }

  private touchClient(client: WebSocket, active = false): void {
    const state = this.clients.get(client);
    if (!state) return;
    const now = Date.now();
    state.lastSeenAt = now;
    const lease = this.activeLease;
    const participant = lease?.participants.get(state.participantId);
    if (!lease || !participant) return;
    participant.lastHeartbeatAt = now;
    const actorChanged = active && lease.activeParticipantId !== participant.id;
    if (active) {
      lease.activeParticipantId = participant.id;
      lease.actor = participant.actor;
    }
    const intervalMs = this.options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    if (actorChanged || now - this.lastHeartbeatStatusAt >= intervalMs) {
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
      if (
        method === 'Browser.setDownloadBehavior' &&
        this.participantForClient(client)?.engine === 'playwright'
      ) {
        this.sendResult(client, id, {});
        return;
      }
      this.sendCdpError(
        client,
        id,
        -32000,
        `${method} requires browser-process ownership and is not supported by Panerelay`,
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
        if (error instanceof TargetHintUnavailableError) {
          const participantId = this.clients.get(client)?.participantId;
          if (participantId) {
            queueMicrotask(() =>
              this.releaseParticipant(participantId, error.message, 1008, 'failed'),
            );
          }
        }
      }
      return;
    }

    this.sendCdpError(
      client,
      id,
      -32000,
      `${method} requires an attached Panerelay target session`,
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
      case 'Target.setDiscoverTargets': {
        state.discoverTargets = params.discover === true;
        const publishInitialTargets =
          state.discoverTargets &&
          (this.participantForClient(client)?.engine === 'playwright' ||
            this.participantForClient(client)?.initialTargetId);
        const targets = publishInitialTargets
          ? this.orderedTargetsForClient(client, await this.refreshTargets())
          : [];
        this.sendResult(client, id, {});
        if (publishInitialTargets) {
          for (const target of targets) {
            if (client.readyState !== WebSocket.OPEN) break;
            client.send(
              JSON.stringify({
                method: 'Target.targetCreated',
                params: { targetInfo: this.toCdpTargetInfo(target, client) },
              }),
            );
          }
        }
        return;
      }
      case 'Target.getTargets': {
        const targets = await this.refreshTargets();
        this.sendResult(client, id, {
          targetInfos: [
            ...this.orderedTargetsForClient(client, targets).map(target =>
              this.toCdpTargetInfo(target, client),
            ),
            ...this.virtualChildTargetInfos(client),
          ],
        });
        return;
      }
      case 'Target.attachToTarget': {
        const targetId = this.requiredTargetId(params);
        const flatten = params.flatten;
        if (flatten !== true) {
          this.sendCdpError(client, id, -32602, 'Panerelay requires flattened CDP sessions');
          return;
        }
        const childTarget = this.physicalChildTargetForClient(client, targetId);
        if (childTarget) {
          const sessionId = randomUUID();
          this.childSessions.set(sessionId, {
            id: sessionId,
            targetId: childTarget.ownerTargetId,
            childTargetId: targetId,
            chromeSessionId: childTarget.chromeSessionId,
            client,
          });
          state.sessions.add(sessionId);
          this.sendResult(client, id, { sessionId });
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
        if (!sessionId || !this.removeClientSession(sessionId, client)) {
          this.sendCdpError(client, id, -32602, 'Unknown Panerelay target session');
          return;
        }
        this.sendResult(client, id, {});
        return;
      }
      case 'Target.createTarget': {
        const url = typeof params.url === 'string' ? params.url : 'about:blank';
        const result = await this.targetCommands.run(TARGET_LIFECYCLE_QUEUE, client, () =>
          this.requestTarget({ kind: 'create', url, active: false }),
        );
        if (!result.success || !result.target)
          throw new Error(result.error || 'Tab creation failed');
        this.targets.set(result.target.targetId, result.target);
        try {
          await this.emitPlaywrightPageAttachment(client, result.target);
        } catch (error) {
          await this.rollbackCreatedTarget(result.target.targetId);
          throw error;
        }
        this.sendResult(client, id, { targetId: result.target.targetId });
        return;
      }
      case 'Target.closeTarget': {
        const targetId = this.requiredTargetId(params);
        await this.ensureKnownTarget(targetId);
        const result = await this.targetCommands.run(targetId, client, () =>
          this.requestTarget({ kind: 'close', targetId }),
        );
        if (!result.success) throw new Error(result.error || 'Tab close failed');
        this.sendResult(client, id, { success: true });
        return;
      }
      case 'Target.activateTarget': {
        const targetId = this.requiredTargetId(params);
        await this.ensureKnownTarget(targetId);
        this.sendResult(client, id, {});
        return;
      }
      case 'Target.getTargetInfo': {
        const targetId =
          typeof params.targetId === 'string'
            ? params.targetId
            : this.participantForClient(client)?.engine === 'playwright'
              ? this.orderedTargetsForClient(client, [...this.targets.values()])[0]?.targetId
              : this.requiredTargetId(params);
        if (typeof targetId !== 'string') {
          this.sendResult(client, id, {
            targetInfo: {
              targetId: 'panerelay-browser',
              type: 'browser',
              title: 'Panerelay',
              url: '',
              attached: true,
              browserContextId: 'panerelay-default',
            },
          });
          return;
        }
        const childTarget = this.physicalChildTargetForClient(client, targetId);
        if (childTarget) {
          this.sendResult(client, id, {
            targetInfo: this.toVirtualChildTargetInfo(client, childTarget),
          });
          return;
        }
        const target = await this.ensureKnownTarget(targetId);
        this.sendResult(client, id, { targetInfo: this.toCdpTargetInfo(target, client) });
        return;
      }
      case 'Target.getBrowserContexts':
        this.sendResult(client, id, { browserContextIds: [] });
        return;
      case 'Target.setAutoAttach': {
        if (
          params.waitForDebuggerOnStart === true &&
          this.participantForClient(client)?.engine !== 'playwright'
        ) {
          this.sendCdpError(
            client,
            id,
            -32000,
            'Panerelay cannot pause new top-level tabs before their first request',
          );
          return;
        }
        const isPlaywrightAutoAttach =
          this.participantForClient(client)?.engine === 'playwright' && params.autoAttach === true;
        if (this.participantForClient(client)?.engine === 'playwright') {
          state.autoAttach = {
            params: {
              ...params,
              ...(isPlaywrightAutoAttach ? { waitForDebuggerOnStart: false } : {}),
            },
            enabled: isPlaywrightAutoAttach,
          };
        }
        if (isPlaywrightAutoAttach) {
          const participant = this.participantForClient(client);
          const targets = this.orderedTargetsForClient(
            client,
            participant?.initialTargetId ? await this.refreshTargets() : [...this.targets.values()],
          );
          if (participant?.initialTargetId) {
            const [initialTarget, ...remainingTargets] = targets;
            if (initialTarget) await this.emitPlaywrightPageAttachment(client, initialTarget);
            for (const target of remainingTargets) {
              try {
                await this.emitPlaywrightPageAttachment(client, target);
              } catch {
                // A target that cannot be attached remains absent from Playwright's page list.
              }
            }
          } else {
            await Promise.all(
              targets.map(async target => {
                try {
                  await this.emitPlaywrightPageAttachment(client, target);
                } catch {
                  // A target that cannot be attached remains absent from Playwright's page list.
                }
              }),
            );
          }
        }
        this.sendResult(client, id, {});
        return;
      }
      default:
        this.sendCdpError(client, id, -32601, `${method} is not supported by Panerelay`);
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
    if (!refreshed) throw new Error('Panerelay target is no longer available');
    return refreshed;
  }

  private async refreshTargets(): Promise<CdpTargetInfo[]> {
    const result = await this.requestTarget({ kind: 'list' });
    if (!result.success || !result.targets) {
      throw new Error(result.error || 'Panerelay could not list authorized targets');
    }
    const nextIds = new Set(result.targets.map(target => target.targetId));
    for (const targetId of this.targets.keys()) {
      if (!nextIds.has(targetId)) this.removeTarget(targetId);
    }
    for (const target of result.targets) this.targets.set(target.targetId, target);
    return result.targets;
  }

  private async requireAvailableInitialTarget(targetId: string): Promise<void> {
    const targets = await this.refreshTargets();
    if (!targets.some(target => target.targetId === targetId)) {
      throw new TargetHintUnavailableError();
    }
  }

  private orderedTargetsForClient(
    client: WebSocket,
    targets: readonly CdpTargetInfo[],
  ): CdpTargetInfo[] {
    const initialTargetId = this.participantForClient(client)?.initialTargetId;
    if (!initialTargetId) return [...targets];
    const target = targets.find(item => item.targetId === initialTargetId);
    if (!target) throw new TargetHintUnavailableError();
    return [target, ...targets.filter(item => item !== target)];
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

  private async rollbackCreatedTarget(targetId: string): Promise<void> {
    try {
      const result = await this.requestTarget({ kind: 'close', targetId });
      if (result.success) this.removeTarget(targetId);
    } catch {
      // Preserve the attachment failure while making rollback best-effort.
    }
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
    if (
      !targetId ||
      (pageSession && pageSession.client !== client) ||
      (childSession && childSession.client !== client)
    ) {
      this.sendCdpError(
        client,
        cdpId,
        -32000,
        'Unknown Panerelay CDP session',
        sessionId,
        'policy-denied',
      );
      return;
    }
    const participant = this.participantForClient(client);
    if (!participant) {
      this.sendCdpError(
        client,
        cdpId,
        -32000,
        'Automation participant disconnected',
        sessionId,
        'transport-error',
      );
      return;
    }

    const policyError = targetCommandPolicyError(this.targets.get(targetId), method, params);
    if (policyError) {
      this.sendCdpError(client, cdpId, -32000, policyError, sessionId, 'policy-denied');
      return;
    }

    if (method === 'Page.bringToFront') {
      this.sendResult(client, cdpId, {}, sessionId);
      return;
    }

    if (pageSession && method === 'Target.setAutoAttach') {
      if (params.autoAttach === true && params.flatten !== true) {
        this.sendCdpError(
          client,
          cdpId,
          -32602,
          'Panerelay requires flattened CDP sessions',
          sessionId,
        );
        return;
      }
      const enabled = params.autoAttach === true;
      pageSession.autoAttach = {
        params: {
          ...params,
          ...(enabled ? { waitForDebuggerOnStart: false } : {}),
        },
        enabled,
      };
      if (!enabled) this.removeAutoAttachedChildSessions(pageSession.id);
      this.sendResult(client, cdpId, {}, sessionId);
      if (enabled && this.attachedTargets.has(targetId)) {
        queueMicrotask(() => this.emitExistingChildAttachments(pageSession));
      }
      return;
    }
    if (childSession && method === 'Target.setAutoAttach') {
      if (params.autoAttach === true && params.flatten !== true) {
        this.sendCdpError(
          client,
          cdpId,
          -32602,
          'Panerelay requires flattened CDP sessions',
          sessionId,
        );
        return;
      }
      childSession.autoAttachEnabled = params.autoAttach === true;
      this.sendResult(client, cdpId, {}, sessionId);
      return;
    }
    if (childSession && method.startsWith('Target.')) {
      this.sendCdpError(
        client,
        cdpId,
        -32601,
        `${method} is not supported on a Panerelay child session`,
        sessionId,
      );
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

    let releaseTarget: () => void;
    try {
      releaseTarget = await this.targetCommands.acquire(targetId, client);
    } catch (error) {
      this.sendCdpError(
        client,
        cdpId,
        -32000,
        error instanceof Error ? error.message : String(error),
        sessionId,
        'transport-error',
      );
      return;
    }
    if (!this.clients.has(client)) {
      releaseTarget();
      return;
    }

    try {
      if (method.startsWith('Input.')) {
        const participantId = this.clients.get(client)?.participantId;
        if (!participantId) throw new Error('Automation participant disconnected');
        await this.ensureFocusEmulation(targetId, participantId);
      }
    } catch (error) {
      releaseTarget();
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
    if (!this.clients.has(client)) {
      releaseTarget();
      return;
    }

    if (classifyCdpTargetAccess(method) === 'control') {
      this.claimTargetControl(targetId, participant);
    }

    const requestId = randomUUID();
    const timeoutMs = this.options.extensionRequestTimeoutMs ?? EXTENSION_REQUEST_TIMEOUT_MS;
    const timer = setTimeout(() => {
      const pending = this.pendingCommands.get(requestId);
      if (!pending) return;
      this.pendingCommands.delete(requestId);
      pending.releaseTarget();
      this.sendCdpError(
        pending.client,
        pending.cdpId,
        -32000,
        'Timed out waiting for Extension CDP result',
        pending.sessionId,
        'transport-error',
      );
    }, timeoutMs);
    timer.unref();
    this.pendingCommands.set(requestId, {
      client,
      cdpId,
      targetId,
      method,
      sessionId,
      ...(childSession ? { chromeSessionId: childSession.chromeSessionId } : {}),
      releaseTarget,
      timer,
    });
    try {
      const forwardedParams =
        participant.engine === 'playwright'
          ? this.replacePlaywrightFrameId(params, targetId, 'to-chrome')
          : params;
      this.options.sendToExtension({
        type: 'cdp.command',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        targetId,
        method,
        engine: participant.engine,
        ...(Object.keys(forwardedParams).length > 0 ? { params: forwardedParams } : {}),
        ...(childSession ? { sessionId: childSession.chromeSessionId } : {}),
      });
    } catch (error) {
      clearTimeout(timer);
      this.pendingCommands.delete(requestId);
      releaseTarget();
      this.sendCdpError(
        client,
        cdpId,
        -32000,
        error instanceof Error ? error.message : String(error),
        sessionId,
        'transport-error',
      );
    }
  }

  private ensureTargetAttached(targetId: string): Promise<void> {
    if (this.attachedTargets.has(targetId) && this.autoAttachTargets.has(targetId)) {
      return Promise.resolve();
    }
    const existing = this.attachPromises.get(targetId);
    if (existing) return existing;

    let attachment: Promise<void> = Promise.resolve();
    if (!this.attachedTargets.has(targetId)) {
      const requestId = randomUUID();
      const timeoutMs = this.options.extensionRequestTimeoutMs ?? EXTENSION_REQUEST_TIMEOUT_MS;
      attachment = new Promise<void>((resolve, reject) => {
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
      });
      this.options.sendToExtension({
        type: 'cdp.attach',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        targetId,
      });
    }

    const promise = attachment
      .then(async () => {
        if (this.autoAttachTargets.has(targetId)) return;
        await this.runSetupCommand(targetId, 'Target.setAutoAttach', CHILD_AUTO_ATTACH_PARAMS);
        if (this.attachedTargets.has(targetId)) this.autoAttachTargets.add(targetId);
      })
      .finally(() => {
        this.attachPromises.delete(targetId);
      });
    this.attachPromises.set(targetId, promise);
    return promise;
  }

  private async ensurePlaywrightTargetReady(targetId: string): Promise<void> {
    await this.ensureTargetAttached(targetId);
    if (this.playwrightMainFrameIds.has(targetId)) return;
    const message = await this.runSetupCommandForResult(targetId, 'Page.getFrameTree', {});
    if (message.error) throw new Error(message.error.message);
    this.capturePlaywrightMainFrameId(targetId, (message.result ?? {}) as Record<string, unknown>);
    if (!this.playwrightMainFrameIds.has(targetId)) {
      throw new Error('Chrome did not return a main frame for the Playwright target');
    }
  }

  private async emitPlaywrightPageAttachment(
    client: WebSocket,
    target: CdpTargetInfo,
  ): Promise<PageSession | undefined> {
    const state = this.clients.get(client);
    if (
      !state?.autoAttach?.enabled ||
      this.participantForClient(client)?.engine !== 'playwright' ||
      client.readyState !== WebSocket.OPEN
    ) {
      return undefined;
    }
    const existing = [...this.pageSessions.values()].find(
      session => session.client === client && session.targetId === target.targetId,
    );
    if (existing) return existing;

    await this.ensurePlaywrightTargetReady(target.targetId);
    const currentState = this.clients.get(client);
    if (
      !currentState?.autoAttach?.enabled ||
      this.participantForClient(client)?.engine !== 'playwright' ||
      client.readyState !== WebSocket.OPEN
    ) {
      return undefined;
    }
    const attached = [...this.pageSessions.values()].find(
      session => session.client === client && session.targetId === target.targetId,
    );
    if (attached) return attached;

    const sessionId = randomUUID();
    const session: PageSession = {
      id: sessionId,
      targetId: target.targetId,
      client,
      autoAttach: { params: currentState.autoAttach.params, enabled: true },
    };
    this.pageSessions.set(sessionId, session);
    currentState.sessions.add(sessionId);
    client.send(
      JSON.stringify({
        method: 'Target.attachedToTarget',
        params: {
          sessionId,
          targetInfo: { ...this.toCdpTargetInfo(target, client), attached: true },
          waitingForDebugger: false,
        },
      }),
    );
    queueMicrotask(() => this.emitExistingChildAttachments(session));
    return session;
  }

  private resolveAttach(message: CdpAttachedMessage): void {
    const pending = this.pendingAttaches.get(message.requestId);
    if (!pending) return;
    this.pendingAttaches.delete(message.requestId);
    clearTimeout(pending.timer);
    pending.resolve(message);
  }

  private runSetupCommand(
    targetId: string,
    method: string,
    params: Record<string, unknown>,
    sessionId?: string,
  ): Promise<void> {
    return this.runSetupCommandForResult(targetId, method, params, sessionId).then(message => {
      if (message.error) throw new Error(message.error.message);
    });
  }

  private runSetupCommandForResult(
    targetId: string,
    method: string,
    params: Record<string, unknown>,
    sessionId?: string,
  ): Promise<CdpResultMessage> {
    const requestId = randomUUID();
    const timeoutMs = this.options.extensionRequestTimeoutMs ?? EXTENSION_REQUEST_TIMEOUT_MS;
    const result = new Promise<CdpResultMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingSetupCommands.delete(requestId);
        reject(new Error(`Timed out applying deferred target setup ${method}`));
      }, timeoutMs);
      timer.unref();
      this.pendingSetupCommands.set(requestId, { resolve, reject, timer });
    });
    try {
      this.options.sendToExtension({
        type: 'cdp.command',
        protocol: PANERELAY_PROTOCOL_VERSION,
        requestId,
        targetId,
        method,
        ...(Object.keys(params).length > 0 ? { params } : {}),
        ...(sessionId ? { sessionId } : {}),
      });
    } catch (error) {
      const pending = this.pendingSetupCommands.get(requestId);
      if (pending) {
        this.pendingSetupCommands.delete(requestId);
        clearTimeout(pending.timer);
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
    return result;
  }

  private resolveSetupCommand(message: CdpResultMessage): boolean {
    const pending = this.pendingSetupCommands.get(message.requestId);
    if (!pending) return false;
    this.pendingSetupCommands.delete(message.requestId);
    clearTimeout(pending.timer);
    pending.resolve(message);
    return true;
  }

  private participantForClient(client: WebSocket): RelayParticipant | undefined {
    const state = this.clients.get(client);
    return state ? this.activeLease?.participants.get(state.participantId) : undefined;
  }

  private virtualChildTargetInfos(client: WebSocket): Record<string, unknown>[] {
    const participant = this.participantForClient(client);
    if (!participant) return [];
    return [...this.childTargets.values()]
      .filter(child => child.type === 'iframe' && this.targets.has(child.ownerTargetId))
      .map(child => this.toVirtualChildTargetInfo(client, child));
  }

  private virtualChildTargetId(participant: RelayParticipant, child: PhysicalChildTarget): string {
    const existing = participant.childTargetIds.get(child.chromeSessionId);
    if (existing) return existing;
    const targetId = randomUUID();
    participant.childTargetIds.set(child.chromeSessionId, targetId);
    return targetId;
  }

  private physicalChildTargetForClient(
    client: WebSocket,
    virtualTargetId: string,
  ): PhysicalChildTarget | undefined {
    const participant = this.participantForClient(client);
    if (!participant) return undefined;
    for (const [chromeSessionId, targetId] of participant.childTargetIds) {
      if (targetId !== virtualTargetId) continue;
      const child = this.childTargets.get(chromeSessionId);
      if (
        child?.type === 'iframe' &&
        child.ownerTargetId &&
        this.targets.has(child.ownerTargetId)
      ) {
        return child;
      }
      return undefined;
    }
    return undefined;
  }

  private toVirtualChildTargetInfo(
    client: WebSocket,
    child: PhysicalChildTarget,
  ): Record<string, unknown> {
    const participant = this.participantForClient(client);
    if (!participant) throw new Error('Automation participant disconnected');
    return {
      targetId: this.virtualChildTargetId(participant, child),
      type: child.type,
      title: child.title,
      url: child.url,
      attached: true,
    };
  }

  private registerPhysicalChild(message: CdpEventMessage): PhysicalChildTarget | undefined {
    const chromeSessionId = message.params?.sessionId;
    const targetInfo = message.params?.targetInfo;
    if (typeof chromeSessionId !== 'string' || !targetInfo || typeof targetInfo !== 'object') {
      return undefined;
    }
    const candidate = targetInfo as Record<string, unknown>;
    if (typeof candidate.targetId !== 'string' || typeof candidate.type !== 'string') {
      return undefined;
    }
    const existing = this.childTargets.get(chromeSessionId);
    const child: PhysicalChildTarget = {
      ownerTargetId: message.targetId,
      chromeSessionId,
      chromeTargetId: candidate.targetId,
      ...(message.sessionId ? { parentChromeSessionId: message.sessionId } : {}),
      type: candidate.type,
      title: typeof candidate.title === 'string' ? candidate.title : '',
      url: typeof candidate.url === 'string' ? candidate.url : '',
    };
    this.childTargets.set(chromeSessionId, child);
    if (!existing && child.type === 'iframe') {
      this.broadcastVirtualChildTargetEvent(child, 'Target.targetCreated');
    }
    this.ensureRecursiveChildAutoAttach(child);
    return child;
  }

  private ensureRecursiveChildAutoAttach(child: PhysicalChildTarget): void {
    if (
      child.type !== 'iframe' ||
      this.autoAttachChildSessions.has(child.chromeSessionId) ||
      this.childAutoAttachPromises.has(child.chromeSessionId)
    ) {
      return;
    }
    const promise = this.runSetupCommand(
      child.ownerTargetId,
      'Target.setAutoAttach',
      CHILD_AUTO_ATTACH_PARAMS,
      child.chromeSessionId,
    )
      .then(() => {
        if (this.childTargets.has(child.chromeSessionId)) {
          this.autoAttachChildSessions.add(child.chromeSessionId);
        }
      })
      .catch(() => undefined)
      .finally(() => this.childAutoAttachPromises.delete(child.chromeSessionId));
    this.childAutoAttachPromises.set(child.chromeSessionId, promise);
  }

  private emitExistingChildAttachments(pageSession: PageSession): void {
    if (!pageSession.autoAttach?.enabled || !this.pageSessions.has(pageSession.id)) return;
    const visit = (parentChromeSessionId: string | undefined, parentSessionId: string): void => {
      for (const child of this.childTargets.values()) {
        if (
          child.ownerTargetId !== pageSession.targetId ||
          child.parentChromeSessionId !== parentChromeSessionId
        ) {
          continue;
        }
        const session = this.emitAutoAttachedChild(pageSession, child, parentSessionId);
        if (session) visit(child.chromeSessionId, session.id);
      }
    };
    visit(undefined, pageSession.id);
  }

  private emitAutoAttachedChild(
    pageSession: PageSession,
    child: PhysicalChildTarget,
    parentSessionId: string,
  ): ChildSession | undefined {
    if (!pageSession.autoAttach?.enabled || pageSession.client.readyState !== WebSocket.OPEN) {
      return undefined;
    }
    const existing = [...this.childSessions.values()].find(
      session =>
        session.chromeSessionId === child.chromeSessionId &&
        session.rootPageSessionId === pageSession.id &&
        session.parentSessionId === parentSessionId,
    );
    if (existing) return existing;
    const participant = this.participantForClient(pageSession.client);
    if (!participant) return undefined;
    const sessionId = randomUUID();
    const childTargetId = this.virtualChildTargetId(participant, child);
    const session: ChildSession = {
      id: sessionId,
      targetId: child.ownerTargetId,
      childTargetId,
      chromeSessionId: child.chromeSessionId,
      client: pageSession.client,
      parentSessionId,
      rootPageSessionId: pageSession.id,
    };
    this.childSessions.set(sessionId, session);
    this.clients.get(pageSession.client)?.sessions.add(sessionId);
    pageSession.client.send(
      JSON.stringify({
        method: 'Target.attachedToTarget',
        params: {
          sessionId,
          targetInfo: this.toVirtualChildTargetInfo(pageSession.client, child),
          waitingForDebugger: false,
        },
        sessionId: parentSessionId,
      }),
    );
    return session;
  }

  private removeAutoAttachedChildSessions(rootPageSessionId: string): void {
    for (const [sessionId, session] of [...this.childSessions]) {
      if (session.rootPageSessionId === rootPageSessionId) this.removeChildSession(sessionId);
    }
  }

  private broadcastVirtualChildTargetEvent(
    child: PhysicalChildTarget,
    method: 'Target.targetCreated' | 'Target.targetInfoChanged' | 'Target.targetDestroyed',
  ): void {
    const lease = this.activeLease;
    if (!lease) return;
    for (const participant of lease.participants.values()) {
      const virtualTargetId =
        method === 'Target.targetDestroyed'
          ? participant.childTargetIds.get(child.chromeSessionId)
          : this.virtualChildTargetId(participant, child);
      if (!virtualTargetId) continue;
      for (const client of participant.clients) {
        const state = this.clients.get(client);
        if (!state?.discoverTargets || client.readyState !== WebSocket.OPEN) continue;
        client.send(
          JSON.stringify({
            method,
            params:
              method === 'Target.targetDestroyed'
                ? { targetId: virtualTargetId }
                : { targetInfo: this.toVirtualChildTargetInfo(client, child) },
          }),
        );
      }
    }
  }

  private updatePhysicalChildTarget(message: CdpEventMessage): boolean {
    const targetInfo = message.params?.targetInfo;
    if (!targetInfo || typeof targetInfo !== 'object') return false;
    const candidate = targetInfo as Record<string, unknown>;
    if (typeof candidate.targetId !== 'string') return false;
    const matches = [...this.childTargets.values()].filter(
      child =>
        child.ownerTargetId === message.targetId && child.chromeTargetId === candidate.targetId,
    );
    if (matches.length === 0) return false;
    for (const child of matches) {
      child.type = typeof candidate.type === 'string' ? candidate.type : child.type;
      child.title = typeof candidate.title === 'string' ? candidate.title : child.title;
      child.url = typeof candidate.url === 'string' ? candidate.url : child.url;
      if (child.type === 'iframe') {
        this.broadcastVirtualChildTargetEvent(child, 'Target.targetInfoChanged');
      }
      for (const session of this.childSessions.values()) {
        if (
          session.chromeSessionId !== child.chromeSessionId ||
          !session.parentSessionId ||
          session.client.readyState !== WebSocket.OPEN
        ) {
          continue;
        }
        session.client.send(
          JSON.stringify({
            method: 'Target.targetInfoChanged',
            params: { targetInfo: this.toVirtualChildTargetInfo(session.client, child) },
            sessionId: session.parentSessionId,
          }),
        );
      }
    }
    return true;
  }

  private removePhysicalChild(chromeSessionId: string, reason: string): boolean {
    const child = this.childTargets.get(chromeSessionId);
    if (!child) return false;
    for (const descendant of [...this.childTargets.values()]) {
      if (descendant.parentChromeSessionId === chromeSessionId) {
        this.removePhysicalChild(descendant.chromeSessionId, reason);
      }
    }
    for (const [sessionId, session] of [...this.childSessions]) {
      if (session.chromeSessionId !== chromeSessionId) continue;
      if (session.client.readyState === WebSocket.OPEN) {
        if (session.parentSessionId) {
          session.client.send(
            JSON.stringify({
              method: 'Target.detachedFromTarget',
              params: { sessionId, targetId: session.childTargetId },
              sessionId: session.parentSessionId,
            }),
          );
        } else {
          session.client.send(
            JSON.stringify({
              method: 'Inspector.detached',
              params: { reason },
              sessionId,
            }),
          );
        }
      }
      this.removeChildSession(sessionId, false);
    }
    if (child.type === 'iframe') {
      this.broadcastVirtualChildTargetEvent(child, 'Target.targetDestroyed');
    }
    for (const participant of this.activeLease?.participants.values() ?? []) {
      participant.childTargetIds.delete(chromeSessionId);
    }
    this.childTargets.delete(chromeSessionId);
    this.autoAttachChildSessions.delete(chromeSessionId);
    this.childAutoAttachPromises.delete(chromeSessionId);
    this.detachTargetIfUnreferenced(child.ownerTargetId);
    return true;
  }

  private async ensureFocusEmulation(targetId: string, participantId: string): Promise<void> {
    if (!this.focusEmulationTargets.has(targetId)) {
      await this.runSetupCommand(targetId, 'Emulation.setFocusEmulationEnabled', {
        enabled: true,
      });
      this.focusEmulationTargets.add(targetId);
    }
    const participants = this.focusEmulationParticipants.get(targetId) ?? new Set<string>();
    participants.add(participantId);
    this.focusEmulationParticipants.set(targetId, participants);
  }

  private releaseParticipantFocusClaims(participantId: string): void {
    for (const [targetId, participants] of [...this.focusEmulationParticipants]) {
      if (!participants.delete(participantId)) continue;
      if (participants.size > 0) continue;
      this.focusEmulationParticipants.delete(targetId);
      void this.disableUnusedFocusEmulation(targetId);
    }
  }

  private async disableUnusedFocusEmulation(targetId: string): Promise<void> {
    if (!this.focusEmulationTargets.has(targetId)) return;
    const owner = [...this.pageSessions.values(), ...this.childSessions.values()].find(
      session => session.targetId === targetId && this.clients.has(session.client),
    )?.client;
    if (!this.attachedTargets.has(targetId)) {
      this.focusEmulationTargets.delete(targetId);
      return;
    }
    if (!owner) {
      this.detachTargetAfterSetupCleanupFailure(targetId);
      return;
    }

    try {
      await this.targetCommands.run(targetId, owner, async () => {
        if (
          (this.focusEmulationParticipants.get(targetId)?.size ?? 0) > 0 ||
          !this.focusEmulationTargets.has(targetId) ||
          !this.attachedTargets.has(targetId)
        ) {
          return;
        }
        await this.runSetupCommand(targetId, 'Emulation.setFocusEmulationEnabled', {
          enabled: false,
        });
        this.focusEmulationTargets.delete(targetId);
      });
    } catch {
      if ((this.focusEmulationParticipants.get(targetId)?.size ?? 0) > 0) return;
      this.detachTargetAfterSetupCleanupFailure(targetId);
    }
  }

  private detachTargetAfterSetupCleanupFailure(targetId: string): void {
    this.focusEmulationTargets.delete(targetId);
    this.focusEmulationParticipants.delete(targetId);
    if (!this.attachedTargets.delete(targetId)) return;
    this.playwrightMainFrameIds.delete(targetId);
    this.clearRuntimeExecutionContexts(targetId);
    this.autoAttachTargets.delete(targetId);
    this.targetControlClaims.delete(targetId);
    this.removePhysicalChildrenForTarget(
      targetId,
      'Panerelay could not restore target focus emulation after participant release',
    );
    this.options.sendToExtension({
      type: 'cdp.detach',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId,
      reason: 'Panerelay could not restore target focus emulation after participant release',
    });
    this.emitCurrentSessionState();
  }

  private virtualizePlaywrightResult(
    pending: PendingCommand,
    result: Record<string, unknown>,
  ): Record<string, unknown> {
    if (pending.method === 'Page.getFrameTree')
      this.capturePlaywrightMainFrameId(pending.targetId, result);
    return this.replacePlaywrightFrameId(result, pending.targetId, 'to-client');
  }

  private capturePlaywrightMainFrameId(targetId: string, result: Record<string, unknown>): void {
    const frameTree = result.frameTree;
    const frame =
      frameTree && typeof frameTree === 'object'
        ? (frameTree as Record<string, unknown>).frame
        : undefined;
    const chromeFrameId =
      frame && typeof frame === 'object' ? (frame as Record<string, unknown>).id : undefined;
    if (typeof chromeFrameId === 'string') {
      this.playwrightMainFrameIds.set(targetId, chromeFrameId);
    }
  }

  private virtualizePlaywrightPayload(
    client: WebSocket,
    targetId: string,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    if (this.participantForClient(client)?.engine !== 'playwright') return payload;
    return this.replacePlaywrightFrameId(payload, targetId, 'to-client');
  }

  private replacePlaywrightFrameId(
    payload: Record<string, unknown>,
    targetId: string,
    direction: 'to-client' | 'to-chrome',
  ): Record<string, unknown> {
    const chromeFrameId = this.playwrightMainFrameIds.get(targetId);
    if (!chromeFrameId) return payload;
    const from = direction === 'to-client' ? chromeFrameId : targetId;
    const to = direction === 'to-client' ? targetId : chromeFrameId;
    return this.replaceCdpFrameIdentifiers(payload, from, to) as Record<string, unknown>;
  }

  private replaceCdpFrameIdentifiers(value: unknown, from: string, to: string): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.replaceCdpFrameIdentifiers(item, from, to));
    }
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if ((key === 'frameId' || key === 'parentFrameId') && item === from) return [key, to];
        if (key === 'frame' && item && typeof item === 'object' && !Array.isArray(item)) {
          return [
            key,
            Object.fromEntries(
              Object.entries(item).map(([frameKey, frameValue]) => [
                frameKey,
                (frameKey === 'id' || frameKey === 'parentId') && frameValue === from
                  ? to
                  : this.replaceCdpFrameIdentifiers(frameValue, from, to),
              ]),
            ),
          ];
        }
        return [key, this.replaceCdpFrameIdentifiers(item, from, to)];
      }),
    );
  }

  private runtimeExecutionContextScope(targetId: string, chromeSessionId?: string): string {
    return `${targetId}\0${chromeSessionId ?? ''}`;
  }

  private trackRuntimeExecutionContext(message: CdpEventMessage): void {
    const scope = this.runtimeExecutionContextScope(message.targetId, message.sessionId);
    if (message.method === 'Runtime.executionContextCreated') {
      const context = message.params?.context;
      const contextId =
        context && typeof context === 'object'
          ? (context as Record<string, unknown>).id
          : undefined;
      if (typeof contextId !== 'number' || !context || typeof context !== 'object') return;
      let contexts = this.runtimeExecutionContexts.get(scope);
      if (!contexts) {
        contexts = new Map();
        this.runtimeExecutionContexts.set(scope, contexts);
      }
      contexts.set(contextId, context as Record<string, unknown>);
      return;
    }
    if (
      message.method === 'Runtime.executionContextDestroyed' ||
      message.method === 'Runtime.executionContextWillBeDestroyed'
    ) {
      const contextId = message.params?.executionContextId;
      if (typeof contextId === 'number') {
        this.runtimeExecutionContexts.get(scope)?.delete(contextId);
      }
      return;
    }
    if (message.method === 'Runtime.executionContextsCleared') {
      this.runtimeExecutionContexts.delete(scope);
    }
  }

  private replayRuntimeExecutionContexts(pending: PendingCommand): void {
    if (
      pending.method !== 'Runtime.enable' ||
      this.participantForClient(pending.client)?.engine !== 'playwright' ||
      pending.client.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    const contexts = this.runtimeExecutionContexts.get(
      this.runtimeExecutionContextScope(pending.targetId, pending.chromeSessionId),
    );
    if (!contexts) return;
    for (const context of contexts.values()) {
      pending.client.send(
        JSON.stringify({
          method: 'Runtime.executionContextCreated',
          params: this.virtualizePlaywrightPayload(pending.client, pending.targetId, { context }),
          ...(pending.sessionId ? { sessionId: pending.sessionId } : {}),
        }),
      );
    }
  }

  private clearRuntimeExecutionContexts(targetId: string): void {
    const prefix = `${targetId}\0`;
    for (const scope of this.runtimeExecutionContexts.keys()) {
      if (scope.startsWith(prefix)) this.runtimeExecutionContexts.delete(scope);
    }
  }

  private forwardResult(message: CdpResultMessage): void {
    const pending = this.pendingCommands.get(message.requestId);
    if (!pending) return;
    this.pendingCommands.delete(message.requestId);
    clearTimeout(pending.timer);
    pending.releaseTarget();
    pending.onResult?.(message);
    this.activityJournal.finish(
      pending.client,
      pending.cdpId,
      message.error ? 'failed' : 'completed',
      message.error ? 'browser-error' : undefined,
    );
    if (pending.client.readyState !== WebSocket.OPEN) return;
    if (!message.error) this.replayRuntimeExecutionContexts(pending);
    const result =
      !message.error && this.participantForClient(pending.client)?.engine === 'playwright'
        ? this.virtualizePlaywrightResult(
            pending,
            (message.result ?? {}) as Record<string, unknown>,
          )
        : (message.result ?? {});
    pending.client.send(
      JSON.stringify({
        id: pending.cdpId,
        ...(message.error ? { error: message.error } : { result }),
        ...(pending.sessionId ? { sessionId: pending.sessionId } : {}),
      }),
    );
  }

  private forwardEvent(message: CdpEventMessage): void {
    this.trackRuntimeExecutionContext(message);
    if (message.method === 'Target.attachedToTarget') {
      const child = this.registerPhysicalChild(message);
      if (!child) return;
      if (message.sessionId) {
        for (const parentSession of [...this.childSessions.values()]) {
          if (
            parentSession.chromeSessionId !== message.sessionId ||
            !parentSession.rootPageSessionId
          ) {
            continue;
          }
          const pageSession = this.pageSessions.get(parentSession.rootPageSessionId);
          if (pageSession) this.emitAutoAttachedChild(pageSession, child, parentSession.id);
        }
      } else {
        for (const pageSession of this.pageSessions.values()) {
          if (pageSession.targetId === message.targetId && pageSession.autoAttach?.enabled) {
            this.emitAutoAttachedChild(pageSession, child, pageSession.id);
          }
        }
      }
      return;
    }
    if (message.method === 'Target.detachedFromTarget') {
      const detachedSessionId = message.params?.sessionId;
      if (typeof detachedSessionId === 'string') {
        this.removePhysicalChild(detachedSessionId, 'Chrome detached the child target');
      }
      return;
    }
    if (message.method === 'Target.targetInfoChanged' && this.updatePhysicalChildTarget(message)) {
      return;
    }
    if (message.method === 'Target.targetDestroyed') {
      const chromeTargetId = message.params?.targetId;
      if (typeof chromeTargetId === 'string') {
        for (const child of [...this.childTargets.values()]) {
          if (child.chromeTargetId === chromeTargetId) {
            this.removePhysicalChild(child.chromeSessionId, 'Chrome destroyed the child target');
          }
        }
      }
      return;
    }

    if (message.sessionId) {
      for (const childSession of this.childSessions.values()) {
        if (
          childSession.chromeSessionId === message.sessionId &&
          childSession.client.readyState === WebSocket.OPEN
        ) {
          childSession.client.send(
            JSON.stringify({
              method: message.method,
              params: this.virtualizePlaywrightPayload(
                childSession.client,
                childSession.targetId,
                message.params ?? {},
              ),
              sessionId: childSession.id,
            }),
          );
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
            params: this.virtualizePlaywrightPayload(
              pageSession.client,
              pageSession.targetId,
              message.params ?? {},
            ),
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
      const participantIds = [...(this.activeLease?.participants.values() ?? [])]
        .filter(participant => participant.initialTargetId === message.targetId)
        .map(participant => participant.id);
      for (const participantId of participantIds) {
        queueMicrotask(() =>
          this.releaseParticipant(
            participantId,
            'The Panerelay conversation target is no longer available',
            1008,
            'failed',
          ),
        );
      }
      return;
    }

    this.targets.set(message.target.targetId, message.target);
    this.broadcastTargetEvent(
      message.event === 'created' ? 'Target.targetCreated' : 'Target.targetInfoChanged',
      { targetInfo: this.toCdpTargetInfo(message.target) },
    );
    if (message.event === 'created') {
      for (const client of this.clients.keys()) {
        void this.emitPlaywrightPageAttachment(client, message.target).catch(() => undefined);
      }
    }
  }

  private broadcastTargetEvent(method: string, params: Record<string, unknown>): void {
    const event = JSON.stringify({ method, params });
    for (const [client, state] of this.clients) {
      if (state.discoverTargets && client.readyState === WebSocket.OPEN) client.send(event);
    }
  }

  private toCdpTargetInfo(target: CdpTargetInfo, client?: WebSocket): Record<string, unknown> {
    return {
      targetId: target.targetId,
      type: target.type,
      title: target.title,
      url: target.url,
      ...(client && this.participantForClient(client)?.engine === 'playwright'
        ? { browserContextId: 'panerelay-default' }
        : {}),
      attached: [...this.pageSessions.values()].some(
        session => session.targetId === target.targetId,
      ),
    };
  }

  private removeTarget(targetId: string): void {
    for (const session of this.pageSessions.values()) {
      if (session.targetId !== targetId || session.client.readyState !== WebSocket.OPEN) continue;
      session.client.send(
        JSON.stringify({
          method: 'Target.detachedFromTarget',
          params: { sessionId: session.id, targetId },
        }),
      );
    }
    this.targets.delete(targetId);
    this.playwrightMainFrameIds.delete(targetId);
    this.clearRuntimeExecutionContexts(targetId);
    const wasAttached = this.attachedTargets.delete(targetId);
    this.autoAttachTargets.delete(targetId);
    this.targetControlClaims.delete(targetId);
    this.focusEmulationTargets.delete(targetId);
    this.focusEmulationParticipants.delete(targetId);
    this.removePhysicalChildrenForTarget(targetId, 'The owning target is no longer authorized');
    for (const [sessionId, session] of [...this.pageSessions]) {
      if (session.targetId === targetId) this.removePageSession(sessionId);
    }
    for (const [sessionId, session] of [...this.childSessions]) {
      if (session.targetId === targetId) this.removeChildSession(sessionId);
    }
    if (wasAttached) this.emitCurrentSessionState();
  }

  private removePageSession(sessionId: string): boolean {
    const session = this.pageSessions.get(sessionId);
    if (!session) return false;
    const participantId = this.clients.get(session.client)?.participantId;
    this.removeAutoAttachedChildSessions(sessionId);
    this.pageSessions.delete(sessionId);
    this.clients.get(session.client)?.sessions.delete(sessionId);
    if (participantId)
      this.releaseTargetControlClaimIfUnreferenced(session.targetId, participantId);
    this.detachTargetIfUnreferenced(session.targetId);
    return true;
  }

  private removeChildSession(sessionId: string, detachIfUnreferenced = true): boolean {
    const session = this.childSessions.get(sessionId);
    if (!session) return false;
    const participantId = this.clients.get(session.client)?.participantId;
    this.childSessions.delete(sessionId);
    this.clients.get(session.client)?.sessions.delete(sessionId);
    for (const [descendantId, descendant] of [...this.childSessions]) {
      if (descendant.parentSessionId === sessionId) {
        this.removeChildSession(descendantId, detachIfUnreferenced);
      }
    }
    if (participantId)
      this.releaseTargetControlClaimIfUnreferenced(session.targetId, participantId);
    if (detachIfUnreferenced) this.detachTargetIfUnreferenced(session.targetId);
    return true;
  }

  private removeClientSession(sessionId: string, client: WebSocket): boolean {
    const pageSession = this.pageSessions.get(sessionId);
    if (pageSession) return pageSession.client === client && this.removePageSession(sessionId);
    const childSession = this.childSessions.get(sessionId);
    return Boolean(
      childSession && childSession.client === client && this.removeChildSession(sessionId),
    );
  }

  private claimTargetControl(targetId: string, participant: RelayParticipant): void {
    const claims = this.targetControlClaims.get(targetId) ?? new Map<string, TargetControlClaim>();
    const wasControlled = claims.size > 0;
    claims.set(participant.id, {
      engine: participant.engine,
      sequence: ++this.controlClaimSequence,
    });
    this.targetControlClaims.set(targetId, claims);
    if (!wasControlled) this.emitCurrentSessionState('active');
  }

  private latestTargetControlClaim(
    targetId: string,
  ): (TargetControlClaim & { participantId: string }) | undefined {
    const claims = this.targetControlClaims.get(targetId);
    if (!claims) return undefined;
    let latest: (TargetControlClaim & { participantId: string }) | undefined;
    for (const [participantId, claim] of claims) {
      if (!latest || claim.sequence > latest.sequence) latest = { participantId, ...claim };
    }
    return latest;
  }

  private participantReferencesTarget(participantId: string, targetId: string): boolean {
    return [...this.pageSessions.values(), ...this.childSessions.values()].some(session => {
      if (session.targetId !== targetId) return false;
      return this.clients.get(session.client)?.participantId === participantId;
    });
  }

  private releaseTargetControlClaimIfUnreferenced(targetId: string, participantId: string): void {
    if (this.participantReferencesTarget(participantId, targetId)) return;
    this.releaseTargetControlClaim(targetId, participantId);
  }

  private releaseTargetControlClaim(targetId: string, participantId: string): boolean {
    const claims = this.targetControlClaims.get(targetId);
    if (!claims?.has(participantId)) return false;
    const previousLatest = this.latestTargetControlClaim(targetId);
    claims.delete(participantId);
    if (claims.size === 0) this.targetControlClaims.delete(targetId);
    const nextLatest = this.latestTargetControlClaim(targetId);

    if (previousLatest?.participantId === participantId) {
      const nextEngine = nextLatest?.engine ?? null;
      if (!nextLatest || nextEngine !== previousLatest.engine) {
        this.options.sendToExtension({
          type: 'cdp.control.updated',
          protocol: PANERELAY_PROTOCOL_VERSION,
          targetId,
          engine: nextEngine,
        });
      }
    }
    if (!nextLatest) this.emitCurrentSessionState();
    return true;
  }

  private releaseParticipantControlClaims(participantId: string): void {
    for (const targetId of [...this.targetControlClaims.keys()]) {
      this.releaseTargetControlClaim(targetId, participantId);
    }
  }

  private detachTargetIfUnreferenced(targetId: string): void {
    const stillReferenced =
      [...this.pageSessions.values()].some(session => session.targetId === targetId) ||
      [...this.childSessions.values()].some(session => session.targetId === targetId);
    if (stillReferenced || !this.attachedTargets.delete(targetId)) return;
    this.playwrightMainFrameIds.delete(targetId);
    this.clearRuntimeExecutionContexts(targetId);
    this.autoAttachTargets.delete(targetId);
    this.targetControlClaims.delete(targetId);
    this.focusEmulationTargets.delete(targetId);
    this.focusEmulationParticipants.delete(targetId);
    this.removePhysicalChildrenForTarget(targetId, 'No CDP sessions remain for the target');
    this.options.sendToExtension({
      type: 'cdp.detach',
      protocol: PANERELAY_PROTOCOL_VERSION,
      targetId,
      reason: 'No CDP sessions remain for the target',
    });
    this.emitCurrentSessionState();
  }

  private removePhysicalChildrenForTarget(targetId: string, reason: string): void {
    for (const child of [...this.childTargets.values()]) {
      if (child.ownerTargetId === targetId) this.removePhysicalChild(child.chromeSessionId, reason);
    }
  }

  private handleDetached(message: CdpDetachedMessage): void {
    if (message.scope === 'target' && message.targetId) {
      const wasAttached = this.attachedTargets.delete(message.targetId);
      this.playwrightMainFrameIds.delete(message.targetId);
      this.clearRuntimeExecutionContexts(message.targetId);
      this.autoAttachTargets.delete(message.targetId);
      this.targetControlClaims.delete(message.targetId);
      this.focusEmulationTargets.delete(message.targetId);
      this.focusEmulationParticipants.delete(message.targetId);
      this.removePhysicalChildrenForTarget(message.targetId, message.reason);
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
    this.revokeActiveLease(message.reason, 1011, false, 'released', true);
  }

  private handleClientClose(client: WebSocket): void {
    const state = this.clients.get(client);
    if (!state) return;
    const participant = this.activeLease?.participants.get(state.participantId);
    this.cleanupClient(client, 'transport-error');
    participant?.clients.delete(client);
    if (participant?.clients.size === 0) {
      this.releaseParticipant(
        participant.id,
        'Automation participant disconnected',
        1000,
        'released',
      );
      return;
    }
    this.emitCurrentSessionState();
  }

  private cleanupClient(client: WebSocket, failure: AutomationActivityFailure): void {
    const state = this.clients.get(client);
    if (!state) return;
    this.activityJournal.failClient(client, failure);
    for (const sessionId of [...state.sessions]) this.removeClientSession(sessionId, client);
    this.clients.delete(client);
    for (const [requestId, pending] of this.pendingCommands) {
      if (pending.client !== client) continue;
      clearTimeout(pending.timer);
      pending.releaseTarget();
      this.pendingCommands.delete(requestId);
    }
    this.targetCommands.cancel(client);
  }

  private releaseParticipant(
    participantId: string,
    reason: string,
    closeCode: number,
    terminalState: Extract<ControlSessionState, 'released' | 'expired' | 'failed'>,
  ): void {
    const lease = this.activeLease;
    const participant = lease?.participants.get(participantId);
    if (!lease || !participant) return;

    this.clearParticipantExpiry(participant);
    this.bootstrapTickets.releaseParticipant(participant);
    lease.participants.delete(participant.id);
    if (lease.participants.size === 0) {
      this.revokeActiveLease(reason, closeCode, true, terminalState);
      return;
    }

    for (const client of [...participant.clients]) {
      this.cleanupClient(client, 'session-ended');
      this.disconnectClient(client, closeCode, reason);
    }
    participant.clients.clear();
    this.releaseParticipantControlClaims(participant.id);
    this.releaseParticipantFocusClaims(participant.id);
    if (lease.activeParticipantId === participant.id) {
      const next = [...lease.participants.values()].at(-1);
      if (next) {
        lease.activeParticipantId = next.id;
        lease.actor = next.actor;
      }
    }
    this.emitCurrentSessionState();
  }

  private revokeActiveLease(
    reason: string,
    closeCode: number,
    notifyExtension: boolean,
    terminalState: Extract<ControlSessionState, 'released' | 'expired' | 'failed'> = 'released',
    invalidateBootstrapTickets = false,
  ): void {
    const lease = this.activeLease;
    if (invalidateBootstrapTickets && lease) {
      for (const participant of lease.participants.values()) {
        this.bootstrapTickets.releaseParticipant(participant);
      }
    }
    if (invalidateBootstrapTickets && this.browser) {
      this.bootstrapTickets.invalidateBinding(
        { browserId: this.browser.browserId, generation: this.generation },
        reason,
      );
    }
    if (!lease) return;
    const hadTargets = this.attachedTargets.size > 0 || this.targets.size > 0;
    this.activityJournal.failOutstanding('session-ended');
    for (const participant of lease.participants.values()) {
      this.clearParticipantExpiry(participant);
    }
    lease.participants.clear();
    this.emitCurrentSessionState(terminalState, 0, 0);
    this.activeLease = null;
    this.clearHeartbeatTimer();
    for (const client of [...this.clients.keys()]) {
      this.disconnectClient(client, closeCode, reason);
    }
    this.clients.clear();
    for (const pending of this.pendingCommands.values()) {
      clearTimeout(pending.timer);
      pending.releaseTarget();
    }
    this.pendingCommands.clear();
    for (const pending of this.pendingSetupCommands.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingSetupCommands.clear();
    this.targetCommands.clear(new Error(reason));
    this.pageSessions.clear();
    this.childSessions.clear();
    this.childTargets.clear();
    this.targets.clear();
    this.playwrightMainFrameIds.clear();
    this.runtimeExecutionContexts.clear();
    this.attachedTargets.clear();
    this.autoAttachTargets.clear();
    this.autoAttachChildSessions.clear();
    this.childAutoAttachPromises.clear();
    this.targetControlClaims.clear();
    this.controlClaimSequence = 0;
    this.focusEmulationTargets.clear();
    this.focusEmulationParticipants.clear();
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
    for (const pending of this.pendingSetupCommands.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingSetupCommands.clear();
  }

  private sendBrowserVersion(client: WebSocket, id: number): void {
    if (client.readyState !== WebSocket.OPEN || !this.browser) return;
    this.sendResult(client, id, {
      protocolVersion: CDP_PROTOCOL_VERSION,
      product: `${this.browser.browserName} via Panerelay`,
      revision: '',
      userAgent: '',
      jsVersion: '',
    });
  }

  private sendResult(client: WebSocket, id: number, result: unknown, sessionId?: string): void {
    this.activityJournal.finish(client, id, 'completed');
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ id, result, ...(sessionId ? { sessionId } : {}) }));
    }
  }

  private sendCdpError(
    client: WebSocket,
    id: number,
    code: number,
    message: string,
    sessionId?: string,
    failure: AutomationActivityFailure = 'policy-denied',
  ): void {
    this.activityJournal.finish(
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
    const lease = this.activeLease;
    const state = this.clients.get(client);
    const participant = state ? lease?.participants.get(state.participantId) : undefined;
    if (!lease || !participant) return;
    this.activityJournal.begin(client, cdpId, {
      sessionId: lease.id,
      actor: participant.actor,
      method,
      ...(targetId ? { targetId } : {}),
    });
  }

  private emitCurrentSessionState(
    state?: ControlSessionState,
    controlledTargetCount = this.targetControlClaims.size,
    observedTargetCount = Math.max(0, this.attachedTargets.size - this.targetControlClaims.size),
  ): void {
    const lease = this.activeLease;
    if (!lease) return;
    const participants = [...lease.participants.values()];
    const lastHeartbeatAt = participants.reduce(
      (latest, participant) => Math.max(latest, participant.lastHeartbeatAt ?? 0),
      0,
    );
    this.activityJournal.emitSession({
      id: lease.id,
      actor: lease.actor,
      participantCount: participants.length,
      observedTargetCount,
      controlledTargetCount,
      lastHeartbeatAt,
      heartbeatTimeoutMs: this.options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS,
      active: this.attachedTargets.size > 0 || this.pendingCommands.size > 0,
      connected: participants.some(participant => participant.connectedAt !== undefined),
      ...(state ? { state } : {}),
    });
  }
}
