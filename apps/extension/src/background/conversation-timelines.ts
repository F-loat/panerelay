import type { ConversationEvent, ConversationSummary } from '@panerelay/protocol';
import {
  CONVERSATION_TIMELINE_SCHEMA,
  CONVERSATION_TIMELINE_VERSION,
  MAX_TIMELINE_EVENTS,
  parseConversationTimelineSnapshot,
  parseSequencedConversationEvent,
  sanitizeConversationEvent,
  type ConversationTimelineReplay,
  type ConversationTimelineSnapshot,
  type SequencedConversationEvent,
} from '../shared/conversation-timeline.js';

const STORAGE_KEY = 'panerelay.conversationTimelines.v1';
const STORE_SCHEMA = 'panerelay.conversation-timeline-store';
const STORE_VERSION = 1;
export const MAX_CONVERSATION_TIMELINE_RECORDS = 30;
export const MAX_CONVERSATION_TIMELINE_RECORD_CHARS = 750_000;
export const MAX_CONVERSATION_TIMELINE_STORE_CHARS = 4_000_000;

interface TimelineStorage {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface ConversationTimelineRecord {
  providerId: string;
  conversationId: string;
  snapshot: ConversationTimelineSnapshot;
  events: SequencedConversationEvent[];
  nextSequence: number;
  updatedAt: string;
}

interface ConversationTimelineStoreEnvelope {
  schema: typeof STORE_SCHEMA;
  version: typeof STORE_VERSION;
  records: Record<string, ConversationTimelineRecord>;
}

export interface ConversationTimelineStoreOptions {
  storage?: TimelineStorage;
  now?: () => string;
  maxRecords?: number;
  maxRecordChars?: number;
  maxStoreChars?: number;
}

function timelineKey(providerId: string, conversationId: string): string {
  return `${encodeURIComponent(providerId)}:${encodeURIComponent(conversationId)}`;
}

function serializedChars(value: unknown): number {
  return JSON.stringify(value).length;
}

function cloneRecord(value: ConversationTimelineRecord): ConversationTimelineRecord {
  return structuredClone(value);
}

function trimRecord(
  record: ConversationTimelineRecord,
  maximum: number,
): ConversationTimelineRecord {
  const next = cloneRecord(record);
  while (next.events.length > 0 && serializedChars(next) > maximum) next.events.shift();
  while (next.snapshot.timeline.length > 0 && serializedChars(next) > maximum) {
    next.snapshot.timeline.shift();
  }
  return next;
}

function parseRecord(value: unknown): ConversationTimelineRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Partial<ConversationTimelineRecord>;
  if (typeof source.providerId !== 'string' || typeof source.conversationId !== 'string') {
    return null;
  }
  const snapshot = parseConversationTimelineSnapshot(source.snapshot, {
    providerId: source.providerId,
    conversationId: source.conversationId,
  });
  if (!snapshot) return null;
  if (
    typeof source.nextSequence !== 'number' ||
    !Number.isSafeInteger(source.nextSequence) ||
    source.nextSequence < snapshot.throughSequence ||
    typeof source.updatedAt !== 'string'
  ) {
    return null;
  }
  const events = Array.isArray(source.events)
    ? source.events
        .map(parseSequencedConversationEvent)
        .filter((item): item is SequencedConversationEvent => item !== null)
        .filter(
          item =>
            item.sequence > snapshot.throughSequence &&
            item.sequence <= source.nextSequence! &&
            'conversationId' in item.event &&
            item.event.conversationId === source.conversationId,
        )
        .sort((left, right) => left.sequence - right.sequence)
        .filter(
          (item, index, values) => index === 0 || values[index - 1]?.sequence !== item.sequence,
        )
        .slice(-MAX_TIMELINE_EVENTS)
    : [];
  return {
    providerId: source.providerId,
    conversationId: source.conversationId,
    snapshot,
    events,
    nextSequence: source.nextSequence,
    updatedAt: source.updatedAt,
  };
}

export class ConversationTimelineStore {
  private fallback: ConversationTimelineStoreEnvelope = {
    schema: STORE_SCHEMA,
    version: STORE_VERSION,
    records: {},
  };
  private queue: Promise<void> = Promise.resolve();
  private readonly storage: TimelineStorage | undefined;
  private readonly now: () => string;
  private readonly maxRecords: number;
  private readonly maxRecordChars: number;
  private readonly maxStoreChars: number;

  constructor(options: ConversationTimelineStoreOptions = {}) {
    this.storage = options.storage;
    this.now = options.now ?? (() => new Date().toISOString());
    this.maxRecords = options.maxRecords ?? MAX_CONVERSATION_TIMELINE_RECORDS;
    this.maxRecordChars = options.maxRecordChars ?? MAX_CONVERSATION_TIMELINE_RECORD_CHARS;
    this.maxStoreChars = options.maxStoreChars ?? MAX_CONVERSATION_TIMELINE_STORE_CHARS;
  }

  async load(providerId: string, conversationId: string): Promise<ConversationTimelineReplay> {
    return this.transact(async envelope => {
      const stored = envelope.records[timelineKey(providerId, conversationId)];
      return {
        changed: false,
        result: stored
          ? { snapshot: structuredClone(stored.snapshot), events: structuredClone(stored.events) }
          : { snapshot: null, events: [] },
      };
    });
  }

  async list(providerId: string): Promise<ConversationSummary[]> {
    if (!providerId) throw new Error('providerId is required');
    return this.transact(async envelope => ({
      changed: false,
      result: Object.values(envelope.records)
        .filter(record => record.providerId === providerId)
        .sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.conversationId.localeCompare(left.conversationId),
        )
        .map(record => ({
          ...structuredClone(record.snapshot.conversation),
          updatedAt:
            record.updatedAt > record.snapshot.conversation.updatedAt
              ? record.updatedAt
              : record.snapshot.conversation.updatedAt,
        })),
    }));
  }

  async save(snapshotValue: ConversationTimelineSnapshot): Promise<ConversationTimelineSnapshot> {
    const parsed = parseConversationTimelineSnapshot(snapshotValue);
    if (!parsed) throw new Error('Invalid conversation timeline snapshot');
    return this.transact(async envelope => {
      const key = timelineKey(parsed.providerId, parsed.conversationId);
      const existing = envelope.records[key];
      const nextSequence = existing?.nextSequence ?? 0;
      if (parsed.throughSequence > nextSequence) {
        throw new Error('Conversation timeline acknowledgement exceeds the stored event sequence');
      }
      const snapshot = { ...parsed, capturedAt: this.now() };
      const nextRecord = trimRecord(
        {
          providerId: parsed.providerId,
          conversationId: parsed.conversationId,
          snapshot,
          events: (existing?.events ?? []).filter(event => event.sequence > parsed.throughSequence),
          nextSequence,
          updatedAt: this.now(),
        },
        this.maxRecordChars,
      );
      envelope.records[key] = nextRecord;
      return { changed: true, result: structuredClone(nextRecord.snapshot) };
    });
  }

  async append(eventValue: ConversationEvent): Promise<number | null> {
    const event = sanitizeConversationEvent(eventValue);
    if (!event || !('conversationId' in event) || !event.conversationId) return null;
    return this.transact(async envelope => {
      const matches = Object.values(envelope.records).filter(
        record => record.conversationId === event.conversationId,
      );
      if (matches.length !== 1) return { changed: false, result: null };
      const existing = matches[0]!;
      const sequence = existing.nextSequence + 1;
      existing.nextSequence = sequence;
      existing.events = [...existing.events, { sequence, event }].slice(-MAX_TIMELINE_EVENTS);
      existing.updatedAt = this.now();
      const key = timelineKey(existing.providerId, existing.conversationId);
      envelope.records[key] = trimRecord(existing, this.maxRecordChars);
      return { changed: true, result: sequence };
    });
  }

  private async transact<T>(
    operation: (
      envelope: ConversationTimelineStoreEnvelope,
    ) => Promise<{ changed: boolean; result: T }>,
  ): Promise<T> {
    let result!: T;
    let failure: unknown;
    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => {
        try {
          const envelope = await this.read();
          const operationResult = await operation(envelope);
          if (operationResult.changed) await this.write(envelope);
          result = operationResult.result;
        } catch (error) {
          failure = error;
        }
      });
    await this.queue;
    if (failure) throw failure;
    return result;
  }

  private async read(): Promise<ConversationTimelineStoreEnvelope> {
    if (!this.storage) return structuredClone(this.fallback);
    const stored = await this.storage.get(STORAGE_KEY);
    const source = stored[STORAGE_KEY];
    const envelope: ConversationTimelineStoreEnvelope = {
      schema: STORE_SCHEMA,
      version: STORE_VERSION,
      records: {},
    };
    if (
      source &&
      typeof source === 'object' &&
      !Array.isArray(source) &&
      (source as { schema?: unknown }).schema === STORE_SCHEMA &&
      (source as { version?: unknown }).version === STORE_VERSION
    ) {
      const records = (source as { records?: unknown }).records;
      if (records && typeof records === 'object' && !Array.isArray(records)) {
        for (const value of Object.values(records)) {
          const parsed = parseRecord(value);
          if (parsed)
            envelope.records[timelineKey(parsed.providerId, parsed.conversationId)] = parsed;
        }
      }
    }
    this.fallback = structuredClone(envelope);
    return envelope;
  }

  private async write(envelope: ConversationTimelineStoreEnvelope): Promise<void> {
    const sorted = Object.entries(envelope.records).sort((left, right) =>
      right[1].updatedAt.localeCompare(left[1].updatedAt),
    );
    envelope.records = Object.fromEntries(sorted.slice(0, this.maxRecords));
    while (serializedChars(envelope) > this.maxStoreChars) {
      const oldest = Object.keys(envelope.records).at(-1);
      if (!oldest) break;
      delete envelope.records[oldest];
    }
    this.fallback = structuredClone(envelope);
    await this.storage?.set({ [STORAGE_KEY]: envelope });
  }
}

export function createChromeConversationTimelineStore(): ConversationTimelineStore {
  return new ConversationTimelineStore({ storage: chrome.storage?.session });
}

export const conversationTimelineStorageMetadata = {
  key: STORAGE_KEY,
  schema: CONVERSATION_TIMELINE_SCHEMA,
  version: CONVERSATION_TIMELINE_VERSION,
};
