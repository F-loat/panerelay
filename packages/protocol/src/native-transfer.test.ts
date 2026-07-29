import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NativeTransferReceiver,
  createNativeTransferCancel,
  encodeNativeTransfer,
  type NativeTransferChunk,
} from './native-transfer.js';

test('reassembles chunked UTF-8 messages and verifies their integrity', () => {
  const message = { type: 'large', value: '浏览器数据'.repeat(40) };
  const frames = encodeNativeTransfer(message, {
    chunkBytes: 31,
    inlineBytes: 20,
    transferId: 'transfer-1',
  });
  const receiver = new NativeTransferReceiver();
  const results = frames.flatMap(frame => receiver.push(frame));

  assert.ok(frames.length > 1);
  assert.deepEqual(results, [message]);
  assert.equal(receiver.pendingCount, 0);
});

test('keeps large logical messages below the Native Messaging frame limit', () => {
  const message = { type: 'screenshot', data: 'x'.repeat(700 * 1024) };
  const frames = encodeNativeTransfer(message, { transferId: 'transfer-large' });
  const receiver = new NativeTransferReceiver();

  assert.ok(frames.length > 1);
  for (const frame of frames) {
    assert.ok(new TextEncoder().encode(JSON.stringify(frame)).length < 1024 * 1024);
  }
  assert.deepEqual(
    frames.flatMap(frame => receiver.push(frame)),
    [message],
  );
});

test('rejects corrupt completed transfers and releases their state', () => {
  const frames = encodeNativeTransfer(
    { type: 'large', value: 'x'.repeat(200) },
    { chunkBytes: 40, inlineBytes: 20, transferId: 'transfer-corrupt' },
  ) as NativeTransferChunk[];
  const receiver = new NativeTransferReceiver();
  const finalFrame = frames.at(-1);
  assert.ok(finalFrame);
  finalFrame.data = `${finalFrame.data.slice(0, -4)}AAAA`;

  assert.throws(() => {
    for (const frame of frames) receiver.push(frame);
  }, /integrity check failed|size check failed/);
  assert.equal(receiver.pendingCount, 0);
});

test('cancels and expires incomplete transfers without retaining chunks', () => {
  const frames = encodeNativeTransfer(
    { type: 'large', value: 'x'.repeat(200) },
    { chunkBytes: 40, inlineBytes: 20, transferId: 'transfer-pending' },
  ) as NativeTransferChunk[];
  const receiver = new NativeTransferReceiver({ timeoutMs: 50 });
  const firstFrame = frames[0];
  assert.ok(firstFrame);

  receiver.push(firstFrame, 100);
  assert.equal(receiver.pendingCount, 1);
  receiver.push(createNativeTransferCancel('transfer-pending', 'Sender stopped'), 110);
  assert.equal(receiver.pendingCount, 0);

  receiver.push(firstFrame, 200);
  assert.deepEqual(receiver.expire(249), []);
  assert.deepEqual(receiver.expire(250), ['transfer-pending']);
  assert.equal(receiver.pendingCount, 0);
});
