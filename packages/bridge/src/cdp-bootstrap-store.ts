import { randomBytes } from 'node:crypto';
import {
  CDP_BOOTSTRAP_DEFAULT_CONNECTION_WINDOW_MS,
  CDP_BOOTSTRAP_DEFAULT_TICKET_TTL_MS,
  CDP_BOOTSTRAP_MAX_OUTSTANDING_TICKETS,
  type CdpBootstrapBrowserBinding,
  type CdpBootstrapConnectionPolicy,
  type CdpBootstrapErrorCode,
  type CdpBootstrapRequest,
  type AutomationEngineId,
  type RelaySessionActor,
} from '@panerelay/protocol';

export class CdpBootstrapStoreError extends Error {
  constructor(
    readonly code: CdpBootstrapErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CdpBootstrapStoreError';
  }
}

export interface CdpBootstrapTicketIssued {
  ticketId: string;
  expiresAt: number;
}

export interface CdpBootstrapTicketContext {
  ticketId: string;
  actor: RelaySessionActor;
  engine: AutomationEngineId;
  browser: CdpBootstrapBrowserBinding;
  laneKey: string;
  connectionPolicy: CdpBootstrapConnectionPolicy;
  connectExpiresAt: number;
  initialTargetId?: string;
}

export interface CdpBootstrapActivation<TParticipant> {
  participant: TParticipant;
  cdpUrl: string;
  connectExpiresAt: number;
}

interface Ticket<TParticipant> {
  id: string;
  actor: RelaySessionActor;
  engine: AutomationEngineId;
  browser: CdpBootstrapBrowserBinding;
  laneKey: string;
  connectionPolicy: CdpBootstrapConnectionPolicy;
  initialTargetId?: string;
  expiresAt: number;
  timer: NodeJS.Timeout;
  activation?: CdpBootstrapActivation<TParticipant>;
}

interface ActiveLane<TParticipant> {
  ticketId: string;
  browser: CdpBootstrapBrowserBinding;
  participant: TParticipant;
}

export interface CdpBootstrapTicketStoreOptions<TParticipant> {
  connectionWindowMs?: number;
  maxOutstandingTickets?: number;
  now?: () => number;
  onParticipantInvalidated?: (participant: TParticipant, reason: string) => void;
  ticketTtlMs?: number;
}

export class CdpBootstrapTicketStore<TParticipant extends object> {
  private readonly tickets = new Map<string, Ticket<TParticipant>>();
  private readonly activeLanes = new Map<string, ActiveLane<TParticipant>>();
  private readonly consumedTickets = new Map<string, string>();
  private readonly expiredTickets = new Map<string, NodeJS.Timeout>();

  constructor(private readonly options: CdpBootstrapTicketStoreOptions<TParticipant> = {}) {}

  issue(request: CdpBootstrapRequest): CdpBootstrapTicketIssued {
    this.removeExpiredTickets();
    const maximum = this.options.maxOutstandingTickets ?? CDP_BOOTSTRAP_MAX_OUTSTANDING_TICKETS;
    if (this.tickets.size >= maximum) {
      throw new CdpBootstrapStoreError(
        'ticket-limit',
        'Too many CDP bootstrap tickets are outstanding',
      );
    }
    const id = randomBytes(32).toString('base64url');
    const expiresAt =
      this.now() + (this.options.ticketTtlMs ?? CDP_BOOTSTRAP_DEFAULT_TICKET_TTL_MS);
    const ticket: Ticket<TParticipant> = {
      id,
      actor: { ...request.actor },
      engine: request.engine,
      browser: { ...request.browser },
      laneKey: request.laneKey,
      connectionPolicy: request.connectionPolicy,
      ...(request.initialTargetId ? { initialTargetId: request.initialTargetId } : {}),
      expiresAt,
      timer: setTimeout(() => this.expireTicket(id), Math.max(0, expiresAt - this.now())),
    };
    ticket.timer.unref();
    this.tickets.set(id, ticket);
    return { ticketId: id, expiresAt };
  }

  activate(
    ticketId: string,
    browser: CdpBootstrapBrowserBinding,
    create: (context: CdpBootstrapTicketContext) => { participant: TParticipant; cdpUrl: string },
  ): CdpBootstrapActivation<TParticipant> {
    const ticket = this.ticket(ticketId, browser);
    if (ticket.activation) return ticket.activation;
    const occupied = this.activeLanes.get(ticket.laneKey);
    if (occupied) {
      throw new CdpBootstrapStoreError(
        'lane-busy',
        'The CDP bootstrap lane already has a connected participant',
      );
    }
    const connectExpiresAt =
      this.now() + (this.options.connectionWindowMs ?? CDP_BOOTSTRAP_DEFAULT_CONNECTION_WINDOW_MS);
    const created = create({
      ticketId,
      actor: { ...ticket.actor },
      engine: ticket.engine,
      browser: { ...ticket.browser },
      laneKey: ticket.laneKey,
      connectionPolicy: ticket.connectionPolicy,
      connectExpiresAt,
      ...(ticket.initialTargetId ? { initialTargetId: ticket.initialTargetId } : {}),
    });
    const activation = { ...created, connectExpiresAt };
    ticket.activation = activation;
    clearTimeout(ticket.timer);
    ticket.expiresAt = connectExpiresAt;
    ticket.timer = setTimeout(
      () => this.expireTicket(ticketId),
      Math.max(0, connectExpiresAt - this.now()),
    );
    ticket.timer.unref();
    this.activeLanes.set(ticket.laneKey, {
      ticketId,
      browser: { ...ticket.browser },
      participant: activation.participant,
    });
    return activation;
  }

  initialTargetId(ticketId: string, browser: CdpBootstrapBrowserBinding): string | undefined {
    return this.ticket(ticketId, browser).initialTargetId;
  }

  consume(
    ticketId: string,
    browser: CdpBootstrapBrowserBinding,
  ): CdpBootstrapActivation<TParticipant> {
    if (this.consumedTickets.has(ticketId)) {
      throw new CdpBootstrapStoreError('ticket-consumed', 'CDP bootstrap ticket was consumed');
    }
    const ticket = this.ticket(ticketId, browser);
    if (!ticket.activation) {
      throw new CdpBootstrapStoreError(
        'ticket-invalid',
        'CDP bootstrap ticket has not created a participant',
      );
    }
    clearTimeout(ticket.timer);
    this.tickets.delete(ticketId);
    this.consumedTickets.set(ticketId, ticket.laneKey);
    return ticket.activation;
  }

  releaseParticipant(participant: TParticipant): boolean {
    for (const [laneKey, lane] of this.activeLanes) {
      if (lane.participant !== participant) continue;
      this.removeLane(laneKey, false);
      return true;
    }
    return false;
  }

  invalidateBinding(
    browser: CdpBootstrapBrowserBinding,
    reason = 'CDP bootstrap browser generation changed',
  ): void {
    for (const ticket of [...this.tickets.values()]) {
      if (this.sameBinding(ticket.browser, browser)) this.removeTicket(ticket.id, reason);
    }
    for (const [laneKey, lane] of [...this.activeLanes]) {
      if (this.sameBinding(lane.browser, browser)) this.removeLane(laneKey, true, reason);
    }
  }

  clear(reason = 'CDP bootstrap store closed'): void {
    for (const ticket of this.tickets.values()) clearTimeout(ticket.timer);
    this.tickets.clear();
    for (const lane of this.activeLanes.values()) {
      this.options.onParticipantInvalidated?.(lane.participant, reason);
    }
    this.activeLanes.clear();
    this.consumedTickets.clear();
    for (const timer of this.expiredTickets.values()) clearTimeout(timer);
    this.expiredTickets.clear();
  }

  snapshot(): { outstandingTickets: number; activeLanes: number; consumedTickets: number } {
    this.removeExpiredTickets();
    return {
      outstandingTickets: this.tickets.size,
      activeLanes: this.activeLanes.size,
      consumedTickets: this.consumedTickets.size,
    };
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private sameBinding(
    left: CdpBootstrapBrowserBinding,
    right: CdpBootstrapBrowserBinding,
  ): boolean {
    return left.browserId === right.browserId && left.generation === right.generation;
  }

  private ticket(ticketId: string, browser: CdpBootstrapBrowserBinding): Ticket<TParticipant> {
    if (this.consumedTickets.has(ticketId)) {
      throw new CdpBootstrapStoreError('ticket-consumed', 'CDP bootstrap ticket was consumed');
    }
    if (this.expiredTickets.has(ticketId)) {
      throw new CdpBootstrapStoreError('ticket-expired', 'CDP bootstrap ticket expired');
    }
    const ticket = this.tickets.get(ticketId);
    if (!ticket)
      throw new CdpBootstrapStoreError('ticket-invalid', 'CDP bootstrap ticket is invalid');
    if (this.now() > ticket.expiresAt) {
      this.expireTicket(ticketId);
      throw new CdpBootstrapStoreError('ticket-expired', 'CDP bootstrap ticket expired');
    }
    if (!this.sameBinding(ticket.browser, browser)) {
      throw new CdpBootstrapStoreError(
        'generation-changed',
        'CDP bootstrap browser generation changed',
      );
    }
    return ticket;
  }

  private removeExpiredTickets(): void {
    const now = this.now();
    for (const ticket of [...this.tickets.values()]) {
      if (now > ticket.expiresAt) this.expireTicket(ticket.id);
    }
  }

  private expireTicket(ticketId: string): void {
    if (!this.tickets.has(ticketId)) return;
    this.removeTicket(ticketId, 'CDP bootstrap ticket expired');
    const timer = setTimeout(
      () => this.expiredTickets.delete(ticketId),
      this.options.ticketTtlMs ?? CDP_BOOTSTRAP_DEFAULT_TICKET_TTL_MS,
    );
    timer.unref();
    this.expiredTickets.set(ticketId, timer);
  }

  private removeTicket(ticketId: string, reason: string): void {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return;
    clearTimeout(ticket.timer);
    this.tickets.delete(ticketId);
    if (ticket.activation) {
      const lane = this.activeLanes.get(ticket.laneKey);
      if (lane?.ticketId === ticketId) {
        this.activeLanes.delete(ticket.laneKey);
        this.options.onParticipantInvalidated?.(ticket.activation.participant, reason);
      }
    }
  }

  private removeLane(
    laneKey: string,
    notify: boolean,
    reason = 'CDP bootstrap lane released',
  ): void {
    const lane = this.activeLanes.get(laneKey);
    if (!lane) return;
    this.activeLanes.delete(laneKey);
    const ticket = this.tickets.get(lane.ticketId);
    if (ticket) {
      clearTimeout(ticket.timer);
      this.tickets.delete(lane.ticketId);
    }
    this.consumedTickets.delete(lane.ticketId);
    if (notify) this.options.onParticipantInvalidated?.(lane.participant, reason);
  }
}
