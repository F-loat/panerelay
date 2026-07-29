import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeTransferReceiver, encodeNativeTransfer } from '@panerelay/protocol';
import { encodeNativeMessage, NativeMessageDecoder } from './native-messaging.js';

test('decodes fragmented and concatenated Native Messaging frames', () => {
  const decoder = new NativeMessageDecoder();
  const first = encodeNativeMessage({ type: 'first', value: 1 });
  const second = encodeNativeMessage({ type: 'second', value: 2 });
  const payload = Buffer.concat([first, second]);

  assert.deepEqual(decoder.push(payload.subarray(0, 3)), []);
  assert.deepEqual(decoder.push(payload.subarray(3, first.length + 2)), [
    { type: 'first', value: 1 },
  ]);
  assert.deepEqual(decoder.push(payload.subarray(first.length + 2)), [
    { type: 'second', value: 2 },
  ]);
});

test('rejects messages above the configured limit before allocating the payload', () => {
  const decoder = new NativeMessageDecoder(8);
  const header = Buffer.alloc(4);
  header.writeUInt32LE(9, 0);

  assert.throws(() => decoder.push(header), /exceeds 8 bytes/);
});

test('composes Native Messaging framing with logical large-message chunks', () => {
  const message = {
    type: 'cdp.result',
    data: 'screenshot'.repeat(80 * 1024),
  };
  const frames = encodeNativeTransfer(message, { transferId: 'native-message-integration' });
  const bytes = Buffer.concat(frames.map(encodeNativeMessage));
  const decoder = new NativeMessageDecoder();
  const receiver = new NativeTransferReceiver();

  const result = decoder.push(bytes).flatMap(frame => receiver.push(frame));

  assert.ok(frames.length > 1);
  assert.deepEqual(result, [message]);
});
