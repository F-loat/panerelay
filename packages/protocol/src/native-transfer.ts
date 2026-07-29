import { PANERELAY_PROTOCOL_VERSION } from './constants.js';

export const PANERELAY_NATIVE_CHUNK_BYTES = 512 * 1024;
export const PANERELAY_NATIVE_TRANSFER_TIMEOUT_MS = 15_000;
export const PANERELAY_NATIVE_TRANSFER_MAX_BYTES = 64 * 1024 * 1024;
export const PANERELAY_NATIVE_TRANSFER_MAX_CHUNKS = 1_024;

export interface NativeTransferChunk {
  type: 'transport.chunk';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  transferId: string;
  index: number;
  total: number;
  totalBytes: number;
  checksum: string;
  data: string;
}

export interface NativeTransferCancel {
  type: 'transport.cancel';
  protocol: typeof PANERELAY_PROTOCOL_VERSION;
  transferId: string;
  reason: string;
}

export type NativeTransferEnvelope = NativeTransferChunk | NativeTransferCancel;

interface PendingTransfer {
  checksum: string;
  chunks: Array<Uint8Array | undefined>;
  expiresAt: number;
  receivedBytes: number;
  totalBytes: number;
}

export interface NativeTransferEncoderOptions {
  chunkBytes?: number;
  inlineBytes?: number;
  transferId?: string;
}

export interface NativeTransferReceiverOptions {
  maxChunkBytes?: number;
  maxTransferBytes?: number;
  timeoutMs?: number;
}

function crc32(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const segmentBytes = 32 * 1024;
  for (let offset = 0; offset < bytes.length; offset += segmentBytes) {
    const segment = bytes.subarray(offset, offset + segmentBytes);
    binary += String.fromCharCode(...segment);
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isNativeTransferEnvelope(value: unknown): value is NativeTransferEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.protocol !== PANERELAY_PROTOCOL_VERSION ||
    typeof candidate.transferId !== 'string' ||
    candidate.transferId.length === 0 ||
    candidate.transferId.length > 128
  ) {
    return false;
  }
  if (candidate.type === 'transport.cancel') {
    return typeof candidate.reason === 'string';
  }
  return (
    candidate.type === 'transport.chunk' &&
    isNonNegativeInteger(candidate.index) &&
    isNonNegativeInteger(candidate.total) &&
    candidate.total > 0 &&
    candidate.index < candidate.total &&
    isNonNegativeInteger(candidate.totalBytes) &&
    typeof candidate.checksum === 'string' &&
    /^[0-9a-f]{8}$/.test(candidate.checksum) &&
    typeof candidate.data === 'string'
  );
}

export function createNativeTransferCancel(
  transferId: string,
  reason: string,
): NativeTransferCancel {
  return {
    type: 'transport.cancel',
    protocol: PANERELAY_PROTOCOL_VERSION,
    transferId,
    reason,
  };
}

export function encodeNativeTransfer(
  message: unknown,
  options: NativeTransferEncoderOptions = {},
): Array<unknown | NativeTransferChunk> {
  const bytes = new TextEncoder().encode(JSON.stringify(message));
  const chunkBytes = options.chunkBytes ?? PANERELAY_NATIVE_CHUNK_BYTES;
  const inlineBytes = options.inlineBytes ?? PANERELAY_NATIVE_CHUNK_BYTES;
  if (
    !Number.isSafeInteger(chunkBytes) ||
    chunkBytes <= 0 ||
    chunkBytes > PANERELAY_NATIVE_CHUNK_BYTES
  ) {
    throw new Error(
      `Native transfer chunk size must be between 1 and ${PANERELAY_NATIVE_CHUNK_BYTES}`,
    );
  }
  if (!Number.isSafeInteger(inlineBytes) || inlineBytes < 0) {
    throw new Error('Native transfer inline size must be a non-negative integer');
  }
  if (bytes.length <= inlineBytes) return [message];
  if (bytes.length > PANERELAY_NATIVE_TRANSFER_MAX_BYTES) {
    throw new Error(`Native transfer payload exceeds ${PANERELAY_NATIVE_TRANSFER_MAX_BYTES} bytes`);
  }

  const transferId = options.transferId ?? crypto.randomUUID();
  const checksum = crc32(bytes);
  const total = Math.ceil(bytes.length / chunkBytes);
  if (total > PANERELAY_NATIVE_TRANSFER_MAX_CHUNKS) {
    throw new Error(
      `Native transfer needs ${total} chunks; the limit is ${PANERELAY_NATIVE_TRANSFER_MAX_CHUNKS}`,
    );
  }
  const frames: NativeTransferChunk[] = [];
  for (let index = 0; index < total; index += 1) {
    const chunk = bytes.subarray(index * chunkBytes, (index + 1) * chunkBytes);
    frames.push({
      type: 'transport.chunk',
      protocol: PANERELAY_PROTOCOL_VERSION,
      transferId,
      index,
      total,
      totalBytes: bytes.length,
      checksum,
      data: encodeBase64(chunk),
    });
  }
  return frames;
}

export class NativeTransferReceiver {
  private readonly pending = new Map<string, PendingTransfer>();
  private readonly maxChunkBytes: number;
  private readonly maxTransferBytes: number;
  private readonly timeoutMs: number;

  constructor(options: NativeTransferReceiverOptions = {}) {
    this.maxChunkBytes = options.maxChunkBytes ?? PANERELAY_NATIVE_CHUNK_BYTES;
    this.maxTransferBytes = options.maxTransferBytes ?? PANERELAY_NATIVE_TRANSFER_MAX_BYTES;
    this.timeoutMs = options.timeoutMs ?? PANERELAY_NATIVE_TRANSFER_TIMEOUT_MS;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  push(message: unknown, now = Date.now()): unknown[] {
    this.expire(now);
    if (!isNativeTransferEnvelope(message)) return [message];
    if (message.type === 'transport.cancel') {
      this.pending.delete(message.transferId);
      return [];
    }
    if (message.totalBytes > this.maxTransferBytes) {
      throw new Error(`Native transfer ${message.transferId} exceeds the configured limit`);
    }
    if (
      message.total > PANERELAY_NATIVE_TRANSFER_MAX_CHUNKS ||
      message.data.length > Math.ceil((this.maxChunkBytes * 4) / 3) + 4
    ) {
      throw new Error(`Native transfer ${message.transferId} has invalid chunk bounds`);
    }

    const current = this.pending.get(message.transferId);
    const transfer =
      current ??
      ({
        checksum: message.checksum,
        chunks: new Array<Uint8Array | undefined>(message.total),
        expiresAt: now + this.timeoutMs,
        receivedBytes: 0,
        totalBytes: message.totalBytes,
      } satisfies PendingTransfer);
    if (!current) this.pending.set(message.transferId, transfer);

    if (
      transfer.chunks.length !== message.total ||
      transfer.totalBytes !== message.totalBytes ||
      transfer.checksum !== message.checksum
    ) {
      this.pending.delete(message.transferId);
      throw new Error(`Native transfer ${message.transferId} metadata changed`);
    }

    let chunk: Uint8Array;
    try {
      chunk = decodeBase64(message.data);
    } catch {
      this.pending.delete(message.transferId);
      throw new Error(`Native transfer ${message.transferId} contains invalid base64`);
    }
    if (chunk.length > this.maxChunkBytes) {
      this.pending.delete(message.transferId);
      throw new Error(`Native transfer ${message.transferId} has an oversized chunk`);
    }
    const existing = transfer.chunks[message.index];
    if (existing) {
      if (
        existing.length !== chunk.length ||
        existing.some((byte, index) => byte !== chunk[index])
      ) {
        this.pending.delete(message.transferId);
        throw new Error(`Native transfer ${message.transferId} repeated a different chunk`);
      }
      return [];
    }

    transfer.chunks[message.index] = chunk;
    transfer.receivedBytes += chunk.length;
    if (transfer.receivedBytes > transfer.totalBytes) {
      this.pending.delete(message.transferId);
      throw new Error(`Native transfer ${message.transferId} exceeded its declared size`);
    }
    if (Array.from(transfer.chunks).some(value => value === undefined)) return [];

    this.pending.delete(message.transferId);
    const bytes = new Uint8Array(transfer.receivedBytes);
    let offset = 0;
    for (const value of transfer.chunks) {
      if (!value) throw new Error(`Native transfer ${message.transferId} is incomplete`);
      bytes.set(value, offset);
      offset += value.length;
    }
    if (bytes.length !== transfer.totalBytes) {
      throw new Error(`Native transfer ${message.transferId} size check failed`);
    }
    if (crc32(bytes) !== transfer.checksum) {
      throw new Error(`Native transfer ${message.transferId} integrity check failed`);
    }

    try {
      return [JSON.parse(new TextDecoder().decode(bytes))];
    } catch {
      throw new Error(`Native transfer ${message.transferId} is not valid JSON`);
    }
  }

  expire(now = Date.now()): string[] {
    const expired: string[] = [];
    for (const [transferId, transfer] of this.pending) {
      if (now < transfer.expiresAt) continue;
      this.pending.delete(transferId);
      expired.push(transferId);
    }
    return expired;
  }

  cancelAll(): void {
    this.pending.clear();
  }
}
