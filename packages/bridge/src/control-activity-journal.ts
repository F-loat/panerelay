import { randomUUID } from 'node:crypto';
import {
  PANERELAY_PROTOCOL_VERSION,
  classifyCdpMethod,
  type AutomationActivity,
  type AutomationActivityFailure,
  type AutomationActivityStatus,
  type ControlSessionChangedMessage,
  type ControlSessionState,
  type HostToExtensionMessage,
  type RelaySessionActor,
} from '@panerelay/protocol';

type ControlActivityMessage = Extract<
  HostToExtensionMessage,
  { type: 'control.activity.snapshot' | 'control.activity.updated' | 'control.session.changed' }
>;

export interface ControlActivityJournalOptions {
  createId?: () => string;
  emit: (message: ControlActivityMessage) => void;
  maxRecords?: number;
  now?: () => number;
}

export interface BeginControlActivity {
  actor: RelaySessionActor;
  method: string;
  sessionId: string;
  targetId?: string;
}

export interface ControlSessionFacts {
  active: boolean;
  actor: RelaySessionActor;
  connected: boolean;
  controlledTargetCount: number;
  heartbeatTimeoutMs: number;
  id: string;
  lastHeartbeatAt: number;
  observedTargetCount: number;
  participantCount: number;
  state?: ControlSessionState;
}

export class ControlActivityJournal<TClient> {
  private readonly activities: AutomationActivity[] = [];
  private readonly clientActivities = new Map<TClient, Map<number, string>>();
  private readonly createId: () => string;
  private readonly epoch: string;
  private readonly maxRecords: number;
  private readonly now: () => number;
  private lastSessionMessage: ControlSessionChangedMessage | null = null;
  private sequence = 0;

  constructor(private readonly options: ControlActivityJournalOptions) {
    this.createId = options.createId ?? randomUUID;
    this.epoch = this.createId();
    this.maxRecords = options.maxRecords ?? 100;
    this.now = options.now ?? Date.now;
  }

  begin(client: TClient, cdpId: number, facts: BeginControlActivity): void {
    this.finish(client, cdpId, 'failed', 'transport-error');

    const now = new Date(this.now()).toISOString();
    const activity: AutomationActivity = {
      id: this.createId(),
      sessionId: facts.sessionId,
      actor: { ...facts.actor },
      ...(facts.targetId ? { targetId: facts.targetId } : {}),
      ...classifyCdpMethod(facts.method),
      status: 'started',
      sequence: this.nextSequence(),
      startedAt: now,
      updatedAt: now,
    };
    const activities = this.clientActivities.get(client) ?? new Map<number, string>();
    activities.set(cdpId, activity.id);
    this.clientActivities.set(client, activities);
    this.storeAndEmit(activity);
  }

  finish(
    client: TClient,
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

  failClient(client: TClient, failure: AutomationActivityFailure): void {
    const activities = this.clientActivities.get(client);
    if (!activities) return;
    for (const activityId of activities.values()) {
      this.finishActivity(activityId, 'failed', failure);
    }
    this.clientActivities.delete(client);
  }

  failOutstanding(failure: AutomationActivityFailure): void {
    for (const client of [...this.clientActivities.keys()]) {
      this.failClient(client, failure);
    }
  }

  emitSession(facts: ControlSessionFacts): void {
    const terminal =
      facts.state === 'released' || facts.state === 'expired' || facts.state === 'failed';
    const resolvedState =
      facts.state ?? (facts.active ? 'active' : facts.connected ? 'connected' : 'allocated');
    const message: ControlSessionChangedMessage = {
      type: 'control.session.changed',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: this.epoch,
      sequence: this.nextSequence(),
      session: {
        id: facts.id,
        actor: { ...facts.actor },
        state: resolvedState,
        participantCount: facts.participantCount,
        observedTargetCount: facts.observedTargetCount,
        controlledTargetCount: facts.controlledTargetCount,
        heartbeatFreshness: terminal
          ? resolvedState === 'expired'
            ? 'stale'
            : 'unknown'
          : facts.lastHeartbeatAt > 0
            ? 'fresh'
            : 'unknown',
        ...(!terminal && facts.lastHeartbeatAt > 0
          ? {
              lastHeartbeatAt: new Date(facts.lastHeartbeatAt).toISOString(),
              leaseExpiresAt: new Date(
                facts.lastHeartbeatAt + facts.heartbeatTimeoutMs,
              ).toISOString(),
            }
          : {}),
        updatedAt: new Date(this.now()).toISOString(),
      },
    };
    this.lastSessionMessage = message;
    this.options.emit(message);
  }

  emitSnapshot(): void {
    if (this.lastSessionMessage) this.options.emit(this.lastSessionMessage);
    const firstRetainedSequence =
      this.activities.length > 0
        ? Math.min(...this.activities.map(activity => activity.sequence))
        : undefined;
    this.options.emit({
      type: 'control.activity.snapshot',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: this.epoch,
      sequence: this.sequence,
      ...(firstRetainedSequence !== undefined ? { firstRetainedSequence } : {}),
      activities: [...this.activities],
    });
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
      sequence: this.nextSequence(),
      updatedAt: new Date(this.now()).toISOString(),
    };
    this.activities[index] = activity;
    this.emitActivity(activity);
  }

  private storeAndEmit(activity: AutomationActivity): void {
    this.activities.push(activity);
    if (this.activities.length > this.maxRecords) this.activities.shift();
    this.emitActivity(activity);
  }

  private emitActivity(activity: AutomationActivity): void {
    this.options.emit({
      type: 'control.activity.updated',
      protocol: PANERELAY_PROTOCOL_VERSION,
      epoch: this.epoch,
      sequence: activity.sequence,
      activity,
    });
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }
}
