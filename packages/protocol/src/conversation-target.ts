export const PANERELAY_CONVERSATION_TARGET_SESSION_PREFIX = 'panerelay-tab-v1-' as const;

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TARGET_SESSION_PATTERN = new RegExp(
  `^${PANERELAY_CONVERSATION_TARGET_SESSION_PREFIX}(${CANONICAL_UUID_PATTERN.source.slice(1, -1)})-(${CANONICAL_UUID_PATTERN.source.slice(1, -1)})$`,
);

export interface ConversationTargetHint {
  browserId: string;
  targetId: string;
}

export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_UUID_PATTERN.test(value);
}

export function isConversationTargetHint(value: unknown): value is ConversationTargetHint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ConversationTargetHint>;
  return (
    Object.keys(value).length === 2 &&
    isCanonicalUuid(candidate.browserId) &&
    isCanonicalUuid(candidate.targetId)
  );
}

export function conversationTargetSessionName(target: ConversationTargetHint): string {
  if (!isConversationTargetHint(target))
    throw new Error('Invalid Panerelay conversation target hint');
  return `${PANERELAY_CONVERSATION_TARGET_SESSION_PREFIX}${target.browserId}-${target.targetId}`;
}

export function parseConversationTargetSessionName(
  value: string,
): ConversationTargetHint | undefined {
  const match = TARGET_SESSION_PATTERN.exec(value);
  return match?.[1] && match[2] ? { browserId: match[1], targetId: match[2] } : undefined;
}
