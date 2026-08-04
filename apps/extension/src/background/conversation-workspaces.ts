import type { ConversationWorkspaceSnapshot } from '../shared/conversation-workspaces.js';

const STORAGE_KEY = 'conversationWorkspacesV1';

interface ConversationWorkspaceRecord {
  cwd?: string;
  groupId: string;
  kind: ConversationWorkspaceSnapshot['kind'];
  providerId: string;
  revision: string;
  conversationId?: string;
}

interface WorkspaceStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface WorkspacePayload {
  cwd?: string;
  kind: ConversationWorkspaceSnapshot['kind'];
  providerId: string;
  conversationId?: string;
}

export interface ConversationWorkspaceReservation {
  groupId: string;
  previous: WorkspacePayload;
  revision: string;
  tabId: number;
}

export interface RemovedConversationWorkspace {
  groupId: string;
  remainingTabCount: number;
  workspace: ConversationWorkspaceSnapshot;
}

export interface ConversationWorkspaceStoreOptions {
  createId?: () => string;
  storage?: WorkspaceStorage;
}

export class WorkspaceRevisionConflictError extends Error {
  constructor() {
    super('The active tab workspace changed before this request completed');
    this.name = 'WorkspaceRevisionConflictError';
  }
}

function validTabId(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validRecord(value: unknown): value is ConversationWorkspaceRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<ConversationWorkspaceRecord>;
  if (
    typeof record.groupId !== 'string' ||
    !record.groupId ||
    typeof record.providerId !== 'string' ||
    !record.providerId ||
    typeof record.revision !== 'string' ||
    !record.revision
  ) {
    return false;
  }
  if (record.cwd !== undefined && (typeof record.cwd !== 'string' || !record.cwd)) return false;
  if (record.kind === 'draft') return record.conversationId === undefined;
  return (
    record.kind === 'conversation' &&
    typeof record.conversationId === 'string' &&
    Boolean(record.conversationId)
  );
}

function cloneRecords(
  records: Record<string, ConversationWorkspaceRecord>,
): Record<string, ConversationWorkspaceRecord> {
  return Object.fromEntries(
    Object.entries(records).map(([tabId, record]) => [tabId, { ...record }]),
  );
}

function payload(record: ConversationWorkspaceRecord): WorkspacePayload {
  return record.kind === 'conversation'
    ? {
        ...(record.cwd ? { cwd: record.cwd } : {}),
        kind: 'conversation',
        providerId: record.providerId,
        conversationId: record.conversationId,
      }
    : {
        ...(record.cwd ? { cwd: record.cwd } : {}),
        kind: 'draft',
        providerId: record.providerId,
      };
}

function snapshot(record: ConversationWorkspaceRecord): ConversationWorkspaceSnapshot {
  return record.kind === 'conversation'
    ? {
        ...(record.cwd ? { cwd: record.cwd } : {}),
        kind: 'conversation',
        providerId: record.providerId,
        revision: record.revision,
        conversationId: record.conversationId!,
      }
    : {
        ...(record.cwd ? { cwd: record.cwd } : {}),
        kind: 'draft',
        providerId: record.providerId,
        revision: record.revision,
      };
}

function samePayload(record: ConversationWorkspaceRecord, next: WorkspacePayload): boolean {
  return (
    record.kind === next.kind &&
    record.cwd === next.cwd &&
    record.providerId === next.providerId &&
    record.conversationId === next.conversationId
  );
}

export class ConversationWorkspaceStore {
  private fallbackRecords: Record<string, ConversationWorkspaceRecord> = {};
  private queue: Promise<void> = Promise.resolve();
  private readonly createId: () => string;
  private readonly storage: WorkspaceStorage | undefined;

  constructor(options: ConversationWorkspaceStoreOptions = {}) {
    this.createId =
      options.createId ??
      (() => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
    this.storage = options.storage;
  }

  async getOrCreate(tabId: number, providerId: string): Promise<ConversationWorkspaceSnapshot> {
    this.assertTabId(tabId);
    if (!providerId) throw new Error('providerId is required');
    return this.transact(async records => {
      const existing = records[String(tabId)];
      if (existing) return { result: snapshot(existing), changed: false };
      const record: ConversationWorkspaceRecord = {
        groupId: this.createId(),
        kind: 'draft',
        providerId,
        revision: this.createId(),
      };
      records[String(tabId)] = record;
      return { result: snapshot(record), changed: true };
    });
  }

  async get(tabId: number): Promise<ConversationWorkspaceSnapshot | null> {
    this.assertTabId(tabId);
    return this.transact(async records => ({
      result: records[String(tabId)] ? snapshot(records[String(tabId)]!) : null,
      changed: false,
    }));
  }

  async reset(
    tabId: number,
    expectedRevision: string,
    providerId: string,
  ): Promise<ConversationWorkspaceSnapshot> {
    this.assertTabId(tabId);
    if (!providerId) throw new Error('providerId is required');
    return this.transact(async records => {
      const existing = this.assertRevision(records, tabId, expectedRevision);
      const record: ConversationWorkspaceRecord = {
        ...(existing.cwd ? { cwd: existing.cwd } : {}),
        groupId: this.createId(),
        kind: 'draft',
        providerId,
        revision: this.createId(),
      };
      records[String(tabId)] = record;
      return { result: snapshot(record), changed: true };
    });
  }

  async setDirectory(
    tabId: number,
    expectedRevision: string,
    cwd?: string,
  ): Promise<ConversationWorkspaceSnapshot> {
    this.assertTabId(tabId);
    return this.transact(async records => {
      const existing = this.assertRevision(records, tabId, expectedRevision);
      if (existing.kind !== 'draft') {
        throw new Error('The project directory can only change before a conversation starts');
      }
      return this.replaceRecords(records, existing, {
        kind: 'draft',
        providerId: existing.providerId,
        ...(cwd ? { cwd } : {}),
      });
    });
  }

  async assertCurrent(
    tabId: number,
    expectedRevision: string,
    expected: Omit<WorkspacePayload, 'kind'> & { kind?: WorkspacePayload['kind'] },
  ): Promise<ConversationWorkspaceSnapshot> {
    this.assertTabId(tabId);
    return this.transact(async records => {
      const existing = this.assertRevision(records, tabId, expectedRevision);
      if (
        (expected.kind && existing.kind !== expected.kind) ||
        existing.providerId !== expected.providerId ||
        existing.conversationId !== expected.conversationId
      ) {
        throw new WorkspaceRevisionConflictError();
      }
      return { result: snapshot(existing), changed: false };
    });
  }

  async bindConversation(
    tabId: number,
    expectedRevision: string,
    providerId: string,
    conversationId: string,
  ): Promise<ConversationWorkspaceSnapshot> {
    if (!conversationId) throw new Error('conversationId is required');
    return this.replace(
      tabId,
      expectedRevision,
      {
        kind: 'conversation',
        providerId,
        conversationId,
      },
      true,
    );
  }

  async inherit(sourceTabId: number, tabId: number): Promise<ConversationWorkspaceSnapshot | null> {
    this.assertTabId(sourceTabId);
    this.assertTabId(tabId);
    if (sourceTabId === tabId) return this.get(tabId);
    return this.transact(async records => {
      const source = records[String(sourceTabId)];
      if (!source) return { result: null, changed: false };
      const existing = records[String(tabId)];
      if (existing) {
        return {
          result: existing.groupId === source.groupId ? snapshot(existing) : null,
          changed: false,
        };
      }
      records[String(tabId)] = { ...source };
      return { result: snapshot(source), changed: true };
    });
  }

  async remove(tabId: number): Promise<RemovedConversationWorkspace | null> {
    this.assertTabId(tabId);
    return this.transact(async records => {
      const existing = records[String(tabId)];
      if (!existing) return { result: null, changed: false };
      delete records[String(tabId)];
      const remainingTabCount = Object.values(records).filter(
        record => record.groupId === existing.groupId,
      ).length;
      return {
        result: {
          groupId: existing.groupId,
          remainingTabCount,
          workspace: snapshot(existing),
        },
        changed: true,
      };
    });
  }

  async reserve(
    tabId: number,
    expectedRevision: string,
  ): Promise<ConversationWorkspaceReservation> {
    this.assertTabId(tabId);
    return this.transact(async records => {
      const existing = this.assertRevision(records, tabId, expectedRevision);
      const revision = this.createId();
      this.updateGroup(records, existing.groupId, payload(existing), revision);
      return {
        result: {
          groupId: existing.groupId,
          previous: payload(existing),
          revision,
          tabId,
        },
        changed: true,
      };
    });
  }

  async commit(
    reservation: ConversationWorkspaceReservation,
    next: WorkspacePayload,
  ): Promise<ConversationWorkspaceSnapshot> {
    return this.finishReservation(reservation, next);
  }

  async rollback(
    reservation: ConversationWorkspaceReservation,
  ): Promise<ConversationWorkspaceSnapshot> {
    return this.finishReservation(reservation, reservation.previous);
  }

  private async replace(
    tabId: number,
    expectedRevision: string,
    next: WorkspacePayload,
    preserveDirectory = false,
  ): Promise<ConversationWorkspaceSnapshot> {
    this.assertTabId(tabId);
    if (!next.providerId) throw new Error('providerId is required');
    return this.transact(async records => {
      const existing = this.assertRevision(records, tabId, expectedRevision);
      const resolvedNext =
        preserveDirectory && existing.cwd ? { ...next, cwd: existing.cwd } : next;
      if (samePayload(existing, resolvedNext)) {
        return { result: snapshot(existing), changed: false };
      }
      return this.replaceRecords(records, existing, resolvedNext);
    });
  }

  private replaceRecords(
    records: Record<string, ConversationWorkspaceRecord>,
    existing: ConversationWorkspaceRecord,
    next: WorkspacePayload,
  ): { changed: boolean; result: ConversationWorkspaceSnapshot } {
    const revision = this.createId();
    this.updateGroup(records, existing.groupId, next, revision);
    const record = Object.values(records).find(
      candidate => candidate.groupId === existing.groupId && candidate.revision === revision,
    );
    if (!record) throw new WorkspaceRevisionConflictError();
    return { result: snapshot(record), changed: true };
  }

  private async finishReservation(
    reservation: ConversationWorkspaceReservation,
    next: WorkspacePayload,
  ): Promise<ConversationWorkspaceSnapshot> {
    if (!next.providerId) throw new Error('providerId is required');
    return this.transact(async records => {
      const existing = this.assertRevision(records, reservation.tabId, reservation.revision);
      if (existing.groupId !== reservation.groupId) throw new WorkspaceRevisionConflictError();
      const revision = this.createId();
      this.updateGroup(records, reservation.groupId, next, revision);
      return {
        result: snapshot(records[String(reservation.tabId)]!),
        changed: true,
      };
    });
  }

  private assertRevision(
    records: Record<string, ConversationWorkspaceRecord>,
    tabId: number,
    expectedRevision: string,
  ): ConversationWorkspaceRecord {
    const existing = records[String(tabId)];
    if (!existing || existing.revision !== expectedRevision) {
      throw new WorkspaceRevisionConflictError();
    }
    return existing;
  }

  private updateGroup(
    records: Record<string, ConversationWorkspaceRecord>,
    groupId: string,
    next: WorkspacePayload,
    revision: string,
  ): void {
    for (const [tabId, record] of Object.entries(records)) {
      if (record.groupId !== groupId) continue;
      records[tabId] = {
        ...(next.cwd ? { cwd: next.cwd } : {}),
        groupId,
        kind: next.kind,
        providerId: next.providerId,
        revision,
        ...(next.kind === 'conversation' ? { conversationId: next.conversationId } : {}),
      };
    }
  }

  private async transact<T>(
    operation: (
      records: Record<string, ConversationWorkspaceRecord>,
    ) => Promise<{ changed: boolean; result: T }>,
  ): Promise<T> {
    let result!: T;
    let failure: unknown;
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        try {
          const records = await this.read();
          const operationResult = await operation(records);
          if (operationResult.changed) await this.write(records);
          result = operationResult.result;
        } catch (error) {
          failure = error;
        }
      });
    await this.queue;
    if (failure) throw failure;
    return result;
  }

  private async read(): Promise<Record<string, ConversationWorkspaceRecord>> {
    if (!this.storage) return cloneRecords(this.fallbackRecords);
    const stored = await this.storage.get(STORAGE_KEY);
    const value = stored[STORAGE_KEY];
    const records: Record<string, ConversationWorkspaceRecord> = {};
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [tabId, record] of Object.entries(value)) {
        if (/^\d+$/.test(tabId) && validRecord(record)) records[tabId] = { ...record };
      }
    }
    this.fallbackRecords = records;
    return cloneRecords(records);
  }

  private async write(records: Record<string, ConversationWorkspaceRecord>): Promise<void> {
    this.fallbackRecords = cloneRecords(records);
    await this.storage?.set({ [STORAGE_KEY]: records });
  }

  private assertTabId(tabId: number): void {
    if (!validTabId(tabId)) throw new Error('tabId must be a non-negative integer');
  }
}

export function createChromeConversationWorkspaceStore(): ConversationWorkspaceStore {
  return new ConversationWorkspaceStore({ storage: chrome.storage?.session });
}
