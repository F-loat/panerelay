export const PANERELAY_CONVERSATION_TARGET_SESSION_PREFIX = 'panerelay-v2-' as const;
export const PANERELAY_LEGACY_CONVERSATION_TARGET_SESSION_PREFIX = 'panerelay-tab-v1-' as const;

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_BYTES = 16;
const TARGET_BYTES = UUID_BYTES * 2;
const TARGET_PAYLOAD_LENGTH = 43;
const TARGET_SESSION_PATTERN = new RegExp(
  `^${PANERELAY_CONVERSATION_TARGET_SESSION_PREFIX}([A-Za-z0-9_-]{${TARGET_PAYLOAD_LENGTH}})$`,
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

function uuidToBytes(value: string): Uint8Array {
  const hex = value.replaceAll('-', '');
  const bytes = new Uint8Array(UUID_BYTES);
  for (let index = 0; index < UUID_BYTES; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function decodeBase64Url(value: string): Uint8Array | undefined {
  try {
    const binary = atob(`${value.replaceAll('-', '+').replaceAll('_', '/')}=`);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return bytes.length === TARGET_BYTES ? bytes : undefined;
  } catch {
    return undefined;
  }
}

export function conversationTargetSessionName(target: ConversationTargetHint): string {
  if (!isConversationTargetHint(target))
    throw new Error('Invalid Panerelay conversation target hint');
  const bytes = new Uint8Array(TARGET_BYTES);
  bytes.set(uuidToBytes(target.browserId), 0);
  bytes.set(uuidToBytes(target.targetId), UUID_BYTES);
  return `${PANERELAY_CONVERSATION_TARGET_SESSION_PREFIX}${encodeBase64Url(bytes)}`;
}

export function parseConversationTargetSessionName(
  value: string,
): ConversationTargetHint | undefined {
  const match = TARGET_SESSION_PATTERN.exec(value);
  if (!match?.[1]) return undefined;
  const bytes = decodeBase64Url(match[1]);
  if (!bytes) return undefined;
  const target = {
    browserId: bytesToUuid(bytes.subarray(0, UUID_BYTES)),
    targetId: bytesToUuid(bytes.subarray(UUID_BYTES)),
  };
  return isConversationTargetHint(target) && conversationTargetSessionName(target) === value
    ? target
    : undefined;
}
