import type {
  ConversationActivity,
  ConversationApproval,
  ConversationEvent,
  ConversationMessage,
  ConversationSummary,
} from '@panerelay/protocol';

export const CONVERSATION_TIMELINE_SCHEMA = 'panerelay.conversation-timeline' as const;
export const CONVERSATION_TIMELINE_VERSION = 1 as const;
export const MAX_TIMELINE_ITEMS = 400;
export const MAX_TIMELINE_EVENTS = 500;
export const MAX_TIMELINE_TEXT_CHARS = 100_000;
export const MAX_TIMELINE_DETAIL_CHARS = 20_000;
export const MAX_TIMELINE_ERROR_CHARS = 20_000;
export const MAX_TIMELINE_ID_CHARS = 1_000;
export const MAX_TIMELINE_TITLE_CHARS = 4_000;

export type TimelineItem =
  | {
      type: 'message';
      message: ConversationMessage;
      segmentId?: string;
      streaming?: boolean;
      turnId?: string;
    }
  | { type: 'reasoning'; id: string; text: string; turnId?: string }
  | { type: 'activity'; activity: ConversationActivity; turnId?: string }
  | { type: 'approval'; approval: ConversationApproval }
  | { type: 'error'; id: string; message: string; turnId?: string };

export interface ConversationTimelineSnapshot {
  schema: typeof CONVERSATION_TIMELINE_SCHEMA;
  version: typeof CONVERSATION_TIMELINE_VERSION;
  providerId: string;
  conversationId: string;
  conversation: ConversationSummary;
  timeline: TimelineItem[];
  runningTurnId: string | null;
  throughSequence: number;
  capturedAt: string;
}

export interface SequencedConversationEvent {
  sequence: number;
  event: ConversationEvent;
}

export interface ConversationTimelineReplay {
  snapshot: ConversationTimelineSnapshot | null;
  events: SequencedConversationEvent[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function boundedString(value: unknown, maximum: number, allowEmpty = false): string | null {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) return null;
  return value.slice(0, maximum);
}

function optionalId(value: unknown): string | undefined {
  return value === undefined
    ? undefined
    : (boundedString(value, MAX_TIMELINE_ID_CHARS) ?? undefined);
}

function finiteSequence(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function sanitizeMessage(value: unknown): ConversationMessage | null {
  const source = record(value);
  if (!source) return null;
  const id = boundedString(source.id, MAX_TIMELINE_ID_CHARS);
  const text = boundedString(source.text, MAX_TIMELINE_TEXT_CHARS, true);
  const createdAt = boundedString(source.createdAt, 100);
  if (!id || text === null || !createdAt) return null;
  if (source.role !== 'user' && source.role !== 'assistant') return null;
  if (source.phase !== undefined && source.phase !== 'commentary' && source.phase !== 'final') {
    return null;
  }
  return {
    id,
    role: source.role,
    text,
    ...(source.phase ? { phase: source.phase } : {}),
    createdAt,
  };
}

function sanitizeSummary(value: unknown): ConversationSummary | null {
  const source = record(value);
  if (!source) return null;
  const id = boundedString(source.id, MAX_TIMELINE_ID_CHARS);
  const providerId = boundedString(source.providerId, MAX_TIMELINE_ID_CHARS);
  const title = boundedString(source.title, MAX_TIMELINE_TITLE_CHARS, true);
  const preview = boundedString(source.preview, MAX_TIMELINE_TITLE_CHARS, true);
  const createdAt = boundedString(source.createdAt, 100);
  const updatedAt = boundedString(source.updatedAt, 100);
  if (!id || !providerId || title === null || preview === null || !createdAt || !updatedAt) {
    return null;
  }
  if (!['idle', 'running', 'waiting', 'error'].includes(String(source.status))) return null;
  const model = boundedString(source.model, MAX_TIMELINE_TITLE_CHARS);
  return {
    id,
    providerId,
    ...(model ? { model } : {}),
    title,
    preview,
    status: source.status as ConversationSummary['status'],
    createdAt,
    updatedAt,
  };
}

function sanitizeActivity(value: unknown): ConversationActivity | null {
  const source = record(value);
  if (!source) return null;
  const id = boundedString(source.id, MAX_TIMELINE_ID_CHARS);
  const title = boundedString(source.title, MAX_TIMELINE_TITLE_CHARS, true);
  if (!id || title === null) return null;
  if (
    !['command', 'file-change', 'browser', 'tool', 'web-search', 'other'].includes(
      String(source.kind),
    )
  ) {
    return null;
  }
  if (!['running', 'completed', 'failed', 'declined'].includes(String(source.status))) return null;
  const output = boundedString(source.output, MAX_TIMELINE_TEXT_CHARS, true);
  const detail = boundedString(source.detail, MAX_TIMELINE_DETAIL_CHARS, true);
  return {
    id,
    kind: source.kind as ConversationActivity['kind'],
    title,
    ...(output !== null ? { output } : {}),
    ...(detail !== null ? { detail } : {}),
    status: source.status as ConversationActivity['status'],
  };
}

export function sanitizeTimelineItem(value: unknown): TimelineItem | null {
  const source = record(value);
  if (!source || typeof source.type !== 'string') return null;
  const turnId = optionalId(source.turnId);
  switch (source.type) {
    case 'message': {
      const message = sanitizeMessage(source.message);
      const segmentId = optionalId(source.segmentId);
      return message
        ? {
            type: 'message',
            message,
            ...(segmentId ? { segmentId } : {}),
            ...(turnId ? { turnId } : {}),
          }
        : null;
    }
    case 'reasoning': {
      const id = boundedString(source.id, MAX_TIMELINE_ID_CHARS);
      const text = boundedString(source.text, MAX_TIMELINE_TEXT_CHARS, true);
      return id && text !== null
        ? { type: 'reasoning', id, text, ...(turnId ? { turnId } : {}) }
        : null;
    }
    case 'activity': {
      const activity = sanitizeActivity(source.activity);
      return activity ? { type: 'activity', activity, ...(turnId ? { turnId } : {}) } : null;
    }
    case 'error': {
      const id = boundedString(source.id, MAX_TIMELINE_ID_CHARS);
      const message = boundedString(source.message, MAX_TIMELINE_ERROR_CHARS, true);
      return id && message !== null
        ? { type: 'error', id, message, ...(turnId ? { turnId } : {}) }
        : null;
    }
    case 'approval':
      return null;
    default:
      return null;
  }
}

export function sanitizeTimeline(timeline: unknown): TimelineItem[] {
  if (!Array.isArray(timeline)) return [];
  return timeline
    .map(sanitizeTimelineItem)
    .filter((item): item is TimelineItem => item !== null)
    .slice(-MAX_TIMELINE_ITEMS);
}

export function createConversationTimelineSnapshot(input: {
  providerId: string;
  conversation: ConversationSummary;
  timeline: TimelineItem[];
  runningTurnId: string | null;
  throughSequence: number;
  capturedAt?: string;
}): ConversationTimelineSnapshot | null {
  const providerId = boundedString(input.providerId, MAX_TIMELINE_ID_CHARS);
  const conversation = sanitizeSummary(input.conversation);
  const throughSequence = finiteSequence(input.throughSequence);
  const capturedAt = boundedString(input.capturedAt ?? new Date().toISOString(), 100);
  const runningTurnId = input.runningTurnId
    ? boundedString(input.runningTurnId, MAX_TIMELINE_ID_CHARS)
    : null;
  if (
    !providerId ||
    !conversation ||
    conversation.providerId !== providerId ||
    throughSequence === null ||
    !capturedAt ||
    (input.runningTurnId && !runningTurnId)
  ) {
    return null;
  }
  return {
    schema: CONVERSATION_TIMELINE_SCHEMA,
    version: CONVERSATION_TIMELINE_VERSION,
    providerId,
    conversationId: conversation.id,
    conversation,
    timeline: sanitizeTimeline(input.timeline),
    runningTurnId,
    throughSequence,
    capturedAt,
  };
}

export function parseConversationTimelineSnapshot(
  value: unknown,
  expected?: { providerId: string; conversationId: string },
): ConversationTimelineSnapshot | null {
  const source = record(value);
  if (
    !source ||
    source.schema !== CONVERSATION_TIMELINE_SCHEMA ||
    source.version !== CONVERSATION_TIMELINE_VERSION
  ) {
    return null;
  }
  const conversation = sanitizeSummary(source.conversation);
  const providerId = boundedString(source.providerId, MAX_TIMELINE_ID_CHARS);
  const conversationId = boundedString(source.conversationId, MAX_TIMELINE_ID_CHARS);
  const throughSequence = finiteSequence(source.throughSequence);
  const capturedAt = boundedString(source.capturedAt, 100);
  const parsedRunningTurnId =
    source.runningTurnId === null ? null : optionalId(source.runningTurnId);
  if (
    !conversation ||
    !providerId ||
    !conversationId ||
    throughSequence === null ||
    !capturedAt ||
    (parsedRunningTurnId === undefined && source.runningTurnId !== null) ||
    conversation.providerId !== providerId ||
    conversation.id !== conversationId ||
    (expected?.providerId && expected.providerId !== providerId) ||
    (expected?.conversationId && expected.conversationId !== conversationId)
  ) {
    return null;
  }
  return {
    schema: CONVERSATION_TIMELINE_SCHEMA,
    version: CONVERSATION_TIMELINE_VERSION,
    providerId,
    conversationId,
    conversation,
    timeline: sanitizeTimeline(source.timeline),
    runningTurnId: parsedRunningTurnId ?? null,
    throughSequence,
    capturedAt,
  };
}

export function sanitizeConversationEvent(value: unknown): ConversationEvent | null {
  const source = record(value);
  if (!source || typeof source.kind !== 'string') return null;
  const conversationId = optionalId(source.conversationId);
  const turnId = optionalId(source.turnId);
  switch (source.kind) {
    case 'turn.started':
      return conversationId && turnId ? { kind: 'turn.started', conversationId, turnId } : null;
    case 'message.delta': {
      const messageId = optionalId(source.messageId);
      const delta = boundedString(source.delta, MAX_TIMELINE_TEXT_CHARS, true);
      if (!conversationId || !turnId || !messageId || delta === null) return null;
      if (source.phase !== undefined && source.phase !== 'commentary' && source.phase !== 'final') {
        return null;
      }
      return {
        kind: 'message.delta',
        conversationId,
        turnId,
        messageId,
        delta,
        ...(source.phase ? { phase: source.phase } : {}),
      };
    }
    case 'message.completed': {
      const message = sanitizeMessage(source.message);
      return conversationId && turnId && message
        ? { kind: 'message.completed', conversationId, turnId, message }
        : null;
    }
    case 'reasoning.delta': {
      const itemId = optionalId(source.itemId);
      const delta = boundedString(source.delta, MAX_TIMELINE_TEXT_CHARS, true);
      return conversationId && turnId && itemId && delta !== null
        ? { kind: 'reasoning.delta', conversationId, turnId, itemId, delta }
        : null;
    }
    case 'activity.updated': {
      const activity = sanitizeActivity(source.activity);
      return conversationId && turnId && activity
        ? { kind: 'activity.updated', conversationId, turnId, activity }
        : null;
    }
    case 'turn.completed': {
      if (
        !conversationId ||
        !turnId ||
        !['completed', 'interrupted', 'failed'].includes(String(source.status))
      ) {
        return null;
      }
      const error = boundedString(source.error, MAX_TIMELINE_ERROR_CHARS, true);
      return {
        kind: 'turn.completed',
        conversationId,
        turnId,
        status: source.status as Extract<ConversationEvent, { kind: 'turn.completed' }>['status'],
        ...(error !== null ? { error } : {}),
      };
    }
    case 'error': {
      const message = boundedString(source.message, MAX_TIMELINE_ERROR_CHARS, true);
      return message === null
        ? null
        : { kind: 'error', ...(conversationId ? { conversationId } : {}), message };
    }
    case 'approval.requested':
    case 'approval.resolved':
    case 'usage.updated':
      return null;
    default:
      return null;
  }
}

export function parseSequencedConversationEvent(value: unknown): SequencedConversationEvent | null {
  const source = record(value);
  if (!source) return null;
  const sequence = finiteSequence(source.sequence);
  const event = sanitizeConversationEvent(source.event);
  return sequence !== null && sequence > 0 && event ? { sequence, event } : null;
}
