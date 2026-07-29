const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024 * 1024;

export class NativeMessageDecoder {
  private buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

  constructor(private readonly maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES) {}

  push(chunk: Buffer): unknown[] {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    const messages: unknown[] = [];

    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0);
      if (length > this.maxMessageBytes) {
        throw new Error(`Native Messaging payload exceeds ${this.maxMessageBytes} bytes`);
      }
      if (this.buffer.length < length + 4) break;

      const payload = this.buffer.subarray(4, length + 4);
      this.buffer = this.buffer.subarray(length + 4);
      messages.push(JSON.parse(payload.toString('utf8')));
    }

    return messages;
  }
}

export function encodeNativeMessage(message: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}
