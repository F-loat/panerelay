import { randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  type RelaySessionActor,
  type WebDriverRendezvousResultMessage,
  type WebDriverTargetInvalidatedMessage,
} from '@panerelay/protocol';
import type { FirefoxDriverManager, FirefoxDriverResponse } from './firefox-driver.js';

const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_WINDOW_HANDLES = 100;
const RENDEZVOUS_TIMEOUT_MS = 350;

interface WindowMapping {
  documentId: string;
  handle: string;
  targetId: string;
}

interface WebDriverParticipant {
  actor: RelaySessionActor;
  id: string;
  mappings: Map<string, WindowMapping>;
  selectedTargetId: string;
  token: string;
  virtualSessionId: string;
}

interface PendingRendezvous {
  challenge: string;
  results: WebDriverRendezvousResultMessage[];
}

export interface WebDriverRelayActivity {
  actor: RelaySessionActor;
  category: 'input' | 'navigation' | 'read' | 'screenshot' | 'script';
  participantId: string;
  targetId: string;
}

export interface FirefoxWebDriverRelayOptions {
  driver: FirefoxDriverManager;
  onActivity?: (
    activity: WebDriverRelayActivity,
    operation: () => Promise<FirefoxDriverResponse>,
  ) => Promise<FirefoxDriverResponse>;
  onConnected?: (participantId: string, targetId: string) => void;
  onMappingsChanged?: (targetIds: ReadonlySet<string>) => void;
  onReleased?: (participantId: string, reason: string) => void;
}

function webdriverError(error: string, message: string): Record<string, unknown> {
  return { value: { error, message, stacktrace: '' } };
}

function categoryForRoute(method: string, suffix: string): WebDriverRelayActivity['category'] {
  if (suffix === '/screenshot') return 'screenshot';
  if (suffix === '/execute/sync') return 'script';
  if (
    method === 'POST' &&
    (suffix === '/url' || suffix === '/back' || suffix === '/forward' || suffix === '/refresh')
  ) {
    return 'navigation';
  }
  if (
    method === 'POST' &&
    (/^\/element\/[^/]+\/(?:click|value|clear)$/.test(suffix) || suffix === '/actions')
  ) {
    return 'input';
  }
  return 'read';
}

function allowedRoute(method: string, suffix: string): boolean {
  if (
    method === 'GET' &&
    ['/url', '/title', '/source', '/screenshot', '/cookie'].includes(suffix)
  ) {
    return true;
  }
  if (
    method === 'POST' &&
    ['/url', '/element', '/execute/sync', '/back', '/forward', '/refresh', '/actions'].includes(
      suffix,
    )
  ) {
    return true;
  }
  return method === 'POST' && /^\/element\/[^/]{1,512}\/(?:click|value|clear)$/.test(suffix);
}

function rewriteSessionIdentity(
  value: unknown,
  realSessionId: string,
  virtualSessionId: string,
): unknown {
  if (value === realSessionId) return virtualSessionId;
  if (Array.isArray(value)) {
    return value.map(item => rewriteSessionIdentity(item, realSessionId, virtualSessionId));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rewriteSessionIdentity(item, realSessionId, virtualSessionId),
      ]),
    );
  }
  return value;
}

export class FirefoxWebDriverRelay {
  private readonly participants = new Map<string, WebDriverParticipant>();
  private readonly pendingRendezvous = new Map<string, PendingRendezvous>();
  private authorizationMode: 'none' | 'single-tab' | 'all-tabs' = 'none';
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: FirefoxWebDriverRelayOptions) {}

  setAuthorizationMode(mode: 'none' | 'single-tab' | 'all-tabs'): void {
    this.authorizationMode = mode;
    if (mode === 'none') this.revokeAll('Firefox automation authorization was released');
  }

  handleRendezvousResult(message: WebDriverRendezvousResultMessage): void {
    const pending = this.pendingRendezvous.get(message.requestId);
    if (!pending || message.challenge !== pending.challenge) return;
    pending.results.push(message);
  }

  invalidateTarget(message: WebDriverTargetInvalidatedMessage): void {
    for (const participant of this.participants.values()) {
      const mapping = participant.mappings.get(message.targetId);
      if (message.documentId && mapping?.documentId !== message.documentId) continue;
      participant.mappings.delete(message.targetId);
      if (participant.selectedTargetId === message.targetId) {
        participant.selectedTargetId = '';
      }
    }
    this.emitMappingsChanged();
  }

  async createParticipant(
    id: string,
    token: string,
    actor: RelaySessionActor,
  ): Promise<{ targetId: string; virtualSessionId: string }> {
    if (!this.options.driver.ready) throw new Error('Firefox WebDriver is not ready');
    if (this.authorizationMode === 'none') {
      throw new Error('Authorize a Firefox tab before starting browser automation');
    }
    const mappings = await this.serialized(() => this.mapAuthorizedWindows());
    const selected =
      [...mappings.values()].find(mapping => mapping.active)?.mapping ??
      [...mappings.values()][0]?.mapping;
    if (!selected) {
      throw new Error('No uniquely authorized Firefox window completed WebDriver rendezvous');
    }
    const participant: WebDriverParticipant = {
      actor,
      id,
      mappings: new Map([...mappings.values()].map(({ mapping }) => [mapping.targetId, mapping])),
      selectedTargetId: selected.targetId,
      token,
      virtualSessionId: randomUUID(),
    };
    this.participants.set(id, participant);
    this.emitMappingsChanged();
    return { targetId: selected.targetId, virtualSessionId: participant.virtualSessionId };
  }

  releaseParticipant(participantId: string, reason: string): void {
    if (!this.participants.delete(participantId)) return;
    this.emitMappingsChanged();
    this.options.onReleased?.(participantId, reason);
  }

  revokeAll(reason: string): void {
    for (const participantId of [...this.participants.keys()]) {
      this.releaseParticipant(participantId, reason);
    }
    this.pendingRendezvous.clear();
    this.emitMappingsChanged();
  }

  async handleHttpRequest(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (!url.pathname.startsWith('/webdriver/')) return false;
    const match = /^\/webdriver\/([^/]+)\/([^/]+)\/session\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if (!match) {
      this.send(response, 404, webdriverError('invalid session id', 'Invalid Panerelay session'));
      return true;
    }
    const participantId = decodeURIComponent(match[1]!);
    const token = decodeURIComponent(match[2]!);
    const virtualSessionId = decodeURIComponent(match[3]!);
    const suffix = match[4] || '';
    const participant = this.participants.get(participantId);
    if (
      !participant ||
      participant.token !== token ||
      participant.virtualSessionId !== virtualSessionId
    ) {
      this.send(response, 404, webdriverError('invalid session id', 'Invalid Panerelay session'));
      return true;
    }
    this.options.onConnected?.(participant.id, participant.selectedTargetId);

    if (request.method === 'GET' && suffix === '/panerelay/heartbeat') {
      this.send(response, 200, { value: null });
      return true;
    }
    if (request.method === 'DELETE' && suffix === '') {
      this.releaseParticipant(participant.id, 'Automation provider released the participant');
      this.send(response, 200, { value: null });
      return true;
    }
    if (
      (request.method === 'GET' && (suffix === '/window' || suffix === '/window/handles')) ||
      (request.method === 'POST' && (suffix === '/window' || suffix === '/window/new')) ||
      (request.method === 'DELETE' && suffix === '/window')
    ) {
      await this.handleWindowRoute(request, response, participant, suffix);
      return true;
    }
    if (!request.method || !allowedRoute(request.method, suffix)) {
      this.send(
        response,
        404,
        webdriverError('unknown command', 'WebDriver route is not supported by Panerelay'),
      );
      return true;
    }
    const mapping = participant.mappings.get(participant.selectedTargetId);
    if (!mapping) {
      this.send(
        response,
        403,
        webdriverError('invalid session id', 'The authorized Firefox target was revoked'),
      );
      return true;
    }

    let body: unknown;
    try {
      body = await this.readBody(request);
    } catch (error) {
      this.send(
        response,
        error instanceof WebDriverHttpError ? error.status : 400,
        webdriverError('invalid argument', error instanceof Error ? error.message : String(error)),
      );
      return true;
    }

    try {
      const result = await this.serialized(async () => {
        const current = participant.mappings.get(mapping.targetId);
        if (!current || current.documentId !== mapping.documentId) {
          throw new WebDriverHttpError(403, 'The authorized Firefox target was revoked');
        }
        await this.switchToWindow(mapping.handle);
        const operation = () =>
          this.options.driver.request(
            request.method as 'GET' | 'POST',
            `/session/${encodeURIComponent(this.options.driver.sessionId)}${suffix}`,
            body,
          );
        const category = categoryForRoute(request.method!, suffix);
        const result = this.options.onActivity
          ? this.options.onActivity(
              {
                actor: participant.actor,
                category,
                participantId: participant.id,
                targetId: mapping.targetId,
              },
              operation,
            )
          : operation();
        const resolved = await result;
        if (category === 'navigation' && resolved.status >= 200 && resolved.status < 400) {
          await this.remapParticipantWindow(participant, mapping.handle);
        }
        return resolved;
      });
      this.send(
        response,
        result.status,
        rewriteSessionIdentity(
          result.body,
          this.options.driver.sessionId,
          participant.virtualSessionId,
        ),
      );
    } catch (error) {
      const status = error instanceof WebDriverHttpError ? error.status : 502;
      this.send(
        response,
        status,
        webdriverError(
          status === 403 ? 'invalid session id' : 'unknown error',
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
    return true;
  }

  private async handleWindowRoute(
    request: IncomingMessage,
    response: ServerResponse,
    participant: WebDriverParticipant,
    suffix: string,
  ): Promise<void> {
    if (request.method === 'GET' && suffix === '/window/handles') {
      this.send(response, 200, { value: [...participant.mappings.keys()] });
      return;
    }
    if (request.method === 'GET' && suffix === '/window') {
      if (!participant.mappings.has(participant.selectedTargetId)) {
        this.send(
          response,
          403,
          webdriverError('no such window', 'The authorized Firefox target was revoked'),
        );
        return;
      }
      this.send(response, 200, { value: participant.selectedTargetId });
      return;
    }

    let body: unknown;
    try {
      body = await this.readBody(request);
    } catch (error) {
      this.send(
        response,
        error instanceof WebDriverHttpError ? error.status : 400,
        webdriverError('invalid argument', error instanceof Error ? error.message : String(error)),
      );
      return;
    }

    if (request.method === 'POST' && suffix === '/window/new') {
      const message =
        this.authorizationMode === 'all-tabs'
          ? 'Creating Firefox windows is unavailable until the agent-browser WebDriver backend can map a new top document safely'
          : 'Creating a Firefox window requires explicit all-tabs authorization';
      this.send(
        response,
        this.authorizationMode === 'all-tabs' ? 501 : 403,
        webdriverError(
          this.authorizationMode === 'all-tabs' ? 'unsupported operation' : 'invalid argument',
          message,
        ),
      );
      return;
    }

    if (request.method === 'POST' && suffix === '/window') {
      const targetId =
        body &&
        typeof body === 'object' &&
        typeof (body as { handle?: unknown }).handle === 'string'
          ? (body as { handle: string }).handle
          : '';
      const mapping = participant.mappings.get(targetId);
      if (!mapping) {
        this.send(
          response,
          403,
          webdriverError('no such window', 'The requested Firefox window is not authorized'),
        );
        return;
      }
      try {
        await this.serialized(() => this.switchToWindow(mapping.handle));
        participant.selectedTargetId = targetId;
        this.options.onConnected?.(participant.id, targetId);
        this.send(response, 200, { value: null });
      } catch (error) {
        this.send(
          response,
          502,
          webdriverError('unknown error', error instanceof Error ? error.message : String(error)),
        );
      }
      return;
    }

    const mapping = participant.mappings.get(participant.selectedTargetId);
    if (!mapping) {
      this.send(
        response,
        403,
        webdriverError('no such window', 'The authorized Firefox target was revoked'),
      );
      return;
    }
    try {
      const result = await this.serialized(async () => {
        await this.switchToWindow(mapping.handle);
        return this.options.driver.request(
          'DELETE',
          `/session/${encodeURIComponent(this.options.driver.sessionId)}/window`,
        );
      });
      if (result.status >= 200 && result.status < 300) {
        this.invalidateHandle(mapping.handle);
        this.send(response, result.status, {
          value: [...participant.mappings.keys()],
        });
      } else {
        this.send(
          response,
          result.status,
          rewriteSessionIdentity(
            result.body,
            this.options.driver.sessionId,
            participant.virtualSessionId,
          ),
        );
      }
    } catch (error) {
      this.send(
        response,
        502,
        webdriverError('unknown error', error instanceof Error ? error.message : String(error)),
      );
    }
  }

  private async mapAuthorizedWindows(): Promise<
    Map<string, { active: boolean; mapping: WindowMapping }>
  > {
    const handlesResult = await this.options.driver.request(
      'GET',
      `/session/${encodeURIComponent(this.options.driver.sessionId)}/window/handles`,
    );
    const handles = this.stringArrayValue(handlesResult.body);
    if (handles.length === 0 || handles.length > MAX_WINDOW_HANDLES) {
      throw new Error('Firefox returned an invalid number of WebDriver windows');
    }
    const currentResult = await this.options.driver.request(
      'GET',
      `/session/${encodeURIComponent(this.options.driver.sessionId)}/window`,
    );
    const currentHandle = this.stringValue(currentResult.body);
    const mappings = new Map<string, { active: boolean; mapping: WindowMapping }>();

    try {
      for (const handle of handles) {
        await this.switchToWindow(handle);
        const mapping = await this.rendezvousWindow(handle);
        if (!mapping) continue;
        if (mappings.has(mapping.mapping.targetId)) {
          throw new Error('Firefox WebDriver rendezvous returned an ambiguous target mapping');
        }
        mappings.set(mapping.mapping.targetId, {
          active: mapping.active,
          mapping: mapping.mapping,
        });
      }
    } finally {
      if (currentHandle && handles.includes(currentHandle)) {
        await this.switchToWindow(currentHandle).catch(() => undefined);
      }
    }
    return mappings;
  }

  private async rendezvousWindow(
    handle: string,
  ): Promise<{ active: boolean; mapping: WindowMapping } | null> {
    const requestId = randomUUID();
    const challenge = randomBytes(32).toString('base64url');
    const pending: PendingRendezvous = { challenge, results: [] };
    this.pendingRendezvous.set(requestId, pending);
    try {
      await this.options.driver.request(
        'POST',
        `/session/${encodeURIComponent(this.options.driver.sessionId)}/execute/sync`,
        {
          script:
            "window.postMessage({source:'panerelay-webdriver-rendezvous',requestId:arguments[0],challenge:arguments[1]}, '*'); return true;",
          args: [requestId, challenge],
        },
      );
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, RENDEZVOUS_TIMEOUT_MS);
        timer.unref();
      });
      const successful = pending.results.filter(
        result =>
          result.success &&
          typeof result.targetId === 'string' &&
          result.targetId.length > 0 &&
          typeof result.documentId === 'string' &&
          result.documentId.length > 0,
      );
      if (successful.length === 0) return null;
      if (successful.length !== 1) {
        throw new Error('Firefox WebDriver rendezvous returned duplicate responses');
      }
      const result = successful[0]!;
      return {
        active: result.active === true,
        mapping: {
          documentId: result.documentId!,
          handle,
          targetId: result.targetId!,
        },
      };
    } finally {
      this.pendingRendezvous.delete(requestId);
    }
  }

  private async remapParticipantWindow(
    participant: WebDriverParticipant,
    handle: string,
  ): Promise<void> {
    for (const [targetId, mapping] of participant.mappings) {
      if (mapping.handle === handle) participant.mappings.delete(targetId);
    }
    participant.selectedTargetId = '';
    this.emitMappingsChanged();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) {
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, 100);
          timer.unref();
        });
      }
      const mapped = await this.rendezvousWindow(handle);
      if (!mapped) continue;
      participant.mappings.set(mapped.mapping.targetId, mapped.mapping);
      participant.selectedTargetId = mapped.mapping.targetId;
      this.emitMappingsChanged();
      this.options.onConnected?.(participant.id, mapped.mapping.targetId);
      return;
    }
  }

  private async switchToWindow(handle: string): Promise<void> {
    const result = await this.options.driver.request(
      'POST',
      `/session/${encodeURIComponent(this.options.driver.sessionId)}/window`,
      { handle },
    );
    if (result.status < 200 || result.status >= 300) {
      throw new Error('Firefox WebDriver could not select an authorized window');
    }
  }

  private invalidateHandle(handle: string): void {
    for (const participant of this.participants.values()) {
      for (const [targetId, mapping] of participant.mappings) {
        if (mapping.handle !== handle) continue;
        participant.mappings.delete(targetId);
        if (participant.selectedTargetId === targetId) {
          participant.selectedTargetId = participant.mappings.keys().next().value ?? '';
        }
      }
    }
    this.emitMappingsChanged();
  }

  private stringArrayValue(body: unknown): string[] {
    if (!body || typeof body !== 'object') return [];
    const value = (body as { value?: unknown }).value;
    return Array.isArray(value)
      ? value.filter(
          (item): item is string =>
            typeof item === 'string' && item.length > 0 && item.length <= 512,
        )
      : [];
  }

  private stringValue(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const value = (body as { value?: unknown }).value;
    return typeof value === 'string' && value.length > 0 && value.length <= 512 ? value : undefined;
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private readBody(request: IncomingMessage): Promise<unknown> {
    if (request.method === 'GET' || request.method === 'DELETE') return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= MAX_REQUEST_BYTES) chunks.push(chunk);
      });
      request.on('end', () => {
        if (size > MAX_REQUEST_BYTES) {
          reject(
            new WebDriverHttpError(413, 'WebDriver request exceeded the Panerelay size limit'),
          );
          return;
        }
        try {
          resolve(size === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new WebDriverHttpError(400, 'WebDriver request body is not valid JSON'));
        }
      });
      request.on('error', reject);
    });
  }

  private send(response: ServerResponse, status: number, body: unknown): void {
    if (response.headersSent || response.destroyed) return;
    response.writeHead(status, {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    });
    response.end(JSON.stringify(body));
  }

  private emitMappingsChanged(): void {
    this.options.onMappingsChanged?.(
      new Set(
        [...this.participants.values()].flatMap(participant => [...participant.mappings.keys()]),
      ),
    );
  }
}

class WebDriverHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
